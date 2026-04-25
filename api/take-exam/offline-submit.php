<?php
// FILE: api/take-exam/offline-submit.php
// Handles recording attempts for exams taken on offline OMR sheets.
// Supports two modes:
//   1. "mark_practiced" — Bulk-mark all questions as attempted (no specific answers).
//   2. "omr_entry"      — Submit specific answers (A/B/C/D) for each question.

require_once '../subject/db_connect.php';
header('Content-Type: application/json');
date_default_timezone_set('Asia/Dhaka');

// Helper function to add to the activity log
function log_activity($conn, $type, $message) {
    $stmt = $conn->prepare("INSERT INTO activity_log (activity_type, activity_message) VALUES (?, ?)");
    $stmt->bind_param("ss", $type, $message);
    $stmt->execute();
    $stmt->close();
}

// Helper: Walk original_question_id chain to find root question ID
function get_root_question_id($conn, $qid, $original_question_id) {
    $master_qid = $original_question_id ? intval($original_question_id) : $qid;
    
    $check_root_stmt = $conn->prepare("SELECT original_question_id FROM questions WHERE id = ?");
    $temp_qid = $master_qid;
    $safety_limit = 10;
    while ($safety_limit > 0) {
        $check_root_stmt->bind_param("i", $temp_qid);
        $check_root_stmt->execute();
        $root_res = $check_root_stmt->get_result();
        if ($root_row = $root_res->fetch_assoc()) {
            if ($root_row['original_question_id']) {
                $temp_qid = intval($root_row['original_question_id']);
                $master_qid = $temp_qid;
                $safety_limit--;
                continue;
            }
        }
        break;
    }
    $check_root_stmt->close();
    return $master_qid;
}

$data = json_decode(file_get_contents("php://input"), true);

if (empty($data['exam_id']) || empty($data['mode'])) {
    echo json_encode(['success' => false, 'message' => 'exam_id and mode are required.']);
    exit;
}

$exam_id = intval($data['exam_id']);
$mode = $data['mode']; // 'mark_practiced' or 'omr_entry'

// Validate exam exists
$exam_stmt = $conn->prepare("SELECT id, exam_title, subject_id, lesson_id, topic_id FROM exams WHERE id = ? AND is_deleted = 0");
$exam_stmt->bind_param("i", $exam_id);
$exam_stmt->execute();
$exam = $exam_stmt->get_result()->fetch_assoc();
$exam_stmt->close();

if (!$exam) {
    echo json_encode(['success' => false, 'message' => 'Exam not found.']);
    exit;
}

// Fetch all questions for this exam
$q_stmt = $conn->prepare("SELECT id, question, answer, original_question_id FROM questions WHERE exam_id = ? AND is_deleted = 0 ORDER BY id ASC");
$q_stmt->bind_param("i", $exam_id);
$q_stmt->execute();
$questions_result = $q_stmt->get_result();
$questions = [];
while ($row = $questions_result->fetch_assoc()) {
    $questions[] = $row;
}
$q_stmt->close();

if (empty($questions)) {
    echo json_encode(['success' => false, 'message' => 'No questions found in this exam.']);
    exit;
}

$conn->begin_transaction();

try {
    $insert_attempt_stmt = $conn->prepare("INSERT INTO question_attempts (question_id, exam_id, selected_answer, is_correct, time_spent_seconds) VALUES (?, ?, ?, ?, ?)");
    $srs_upsert = $conn->prepare("INSERT INTO question_srs (question_id, question_text_hash, next_review_at, interval_days, consecutive_correct) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE question_id = VALUES(question_id), next_review_at = VALUES(next_review_at), interval_days = VALUES(interval_days), consecutive_correct = VALUES(consecutive_correct)");

    $total_questions = count($questions);
    $correct_count = 0;
    $wrong_count = 0;
    $skipped_count = 0;

    if ($mode === 'mark_practiced') {
        // Mode A: Bulk mark all as "seen/practiced" — no specific answers
        foreach ($questions as $q) {
            $master_qid = get_root_question_id($conn, $q['id'], $q['original_question_id']);
            
            $selected = null;
            $is_correct = 0;
            $time_spent = 0;
            
            $insert_attempt_stmt->bind_param("iisii", $master_qid, $exam_id, $selected, $is_correct, $time_spent);
            $insert_attempt_stmt->execute();
            $skipped_count++;
        }
        
    } elseif ($mode === 'omr_entry') {
        // Mode B: Process specific OMR answers
        $omr_answers = isset($data['answers']) ? $data['answers'] : [];
        // answers format: { "question_id": "A", "question_id": "B", ... } or by index { "0": "A", "1": "B", ... }
        
        foreach ($questions as $index => $q) {
            $master_qid = get_root_question_id($conn, $q['id'], $q['original_question_id']);
            $q_text = trim($q['question']);
            $q_hash = md5($q_text);
            
            // Look up answer by question ID first, then by index
            $selected = null;
            if (isset($omr_answers[strval($q['id'])])) {
                $selected = $omr_answers[strval($q['id'])];
            } elseif (isset($omr_answers[strval($index)])) {
                $selected = $omr_answers[strval($index)];
            }
            
            $correct_answer = $q['answer'];
            $is_correct = ($selected !== null && $selected === $correct_answer) ? 1 : 0;
            $time_spent = 0;
            
            $insert_attempt_stmt->bind_param("iisii", $master_qid, $exam_id, $selected, $is_correct, $time_spent);
            $insert_attempt_stmt->execute();
            
            if ($selected === null) {
                $skipped_count++;
            } elseif ($is_correct) {
                $correct_count++;
            } else {
                $wrong_count++;
            }
            
            // SRS update for answered questions
            if ($selected !== null) {
                $state_stmt = $conn->prepare("SELECT interval_days, consecutive_correct FROM question_srs WHERE question_text_hash = ?");
                $state_stmt->bind_param("s", $q_hash);
                $state_stmt->execute();
                $srs_state = $state_stmt->get_result()->fetch_assoc();
                $state_stmt->close();

                $new_interval = 1;
                $new_consecutive = 0;

                if ($is_correct) {
                    $cur_consecutive = $srs_state ? $srs_state['consecutive_correct'] : 0;
                    $new_consecutive = $cur_consecutive + 1;
                    if ($new_consecutive === 1) $new_interval = 1;
                    elseif ($new_consecutive === 2) $new_interval = 3;
                    else $new_interval = 7;
                }

                $next_review = date('Y-m-d 00:00:00', strtotime("+$new_interval days"));
                $srs_upsert->bind_param("issii", $master_qid, $q_hash, $next_review, $new_interval, $new_consecutive);
                $srs_upsert->execute();
            }
        }
    } else {
        throw new Exception("Invalid mode: $mode. Use 'mark_practiced' or 'omr_entry'.");
    }

    $insert_attempt_stmt->close();
    $srs_upsert->close();

    // Log activity
    $mode_label = ($mode === 'mark_practiced') ? 'Practiced (Offline)' : 'OMR Entry';
    log_activity($conn, 'offline_exam_attempt', "Exam '{$exam['exam_title']}' recorded as $mode_label. Correct: $correct_count, Wrong: $wrong_count, Skipped: $skipped_count");

    // Update subject discipline tracking
    if ($exam['subject_id']) {
        $update_subject = $conn->prepare("
            UPDATE subjects 
            SET study_streak = CASE 
                WHEN DATE(last_study_at) = CURRENT_DATE THEN study_streak
                WHEN DATE(last_study_at) = DATE_SUB(CURRENT_DATE, INTERVAL 1 DAY) THEN study_streak + 1
                ELSE 1 
            END,
            last_study_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        ");
        $update_subject->bind_param("i", $exam['subject_id']);
        $update_subject->execute();
        $update_subject->close();
    }

    $conn->commit();

    $score = $total_questions > 0 ? round(($correct_count / $total_questions) * 100, 1) : 0;

    echo json_encode([
        'success' => true,
        'message' => "Offline attempt recorded successfully.",
        'data' => [
            'mode' => $mode,
            'total' => $total_questions,
            'correct' => $correct_count,
            'wrong' => $wrong_count,
            'skipped' => $skipped_count,
            'score_percent' => $score
        ]
    ]);

} catch (Exception $e) {
    $conn->rollback();
    echo json_encode(['success' => false, 'message' => 'Error: ' . $e->getMessage()]);
}

$conn->close();
?>
