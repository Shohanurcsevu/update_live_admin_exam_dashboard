<?php
require_once '../subject/db_connect.php';
date_default_timezone_set('Asia/Dhaka');

// Helper function to add to the activity log
function log_activity($conn, $type, $message) {
    $stmt = $conn->prepare("INSERT INTO activity_log (activity_type, activity_message) VALUES (?, ?)");
    $stmt->bind_param("ss", $type, $message);
    $stmt->execute();
    $stmt->close();
}

$data = json_decode(file_get_contents("php://input"), true);

if (empty($data['exam_id']) || !isset($data['performance'])) {
    echo json_encode(['success' => false, 'message' => 'Required data missing.']);
    exit;
}

$exam_id = intval($data['exam_id']);
$performance = $data['performance'];

// Get exam details to verify IDs
$exam_stmt = $conn->prepare("SELECT subject_id, lesson_id, topic_id, exam_title FROM exams WHERE id = ?");
$exam_stmt->bind_param("i", $exam_id);
$exam_stmt->execute();
$exam_details = $exam_stmt->get_result()->fetch_assoc();
$exam_stmt->close();

if (!$exam_details) {
    echo json_encode(['success' => false, 'message' => 'Invalid Exam ID.']);
    exit;
}

// Get the latest attempt number and increment it
$attempt_stmt = $conn->prepare("SELECT MAX(attempt_number) as max_attempt FROM performance WHERE exam_id = ?");
$attempt_stmt->bind_param("i", $exam_id);
$attempt_stmt->execute();
$last_attempt = $attempt_stmt->get_result()->fetch_assoc()['max_attempt'];
$new_attempt_number = $last_attempt ? $last_attempt + 1 : 1;
$attempt_stmt->close();

$subject_id = $exam_details['subject_id'];
$lesson_id = $exam_details['lesson_id'];
$topic_id = $exam_details['topic_id'] ? intval($exam_details['topic_id']) : NULL;
$selected_answers_json = json_encode($performance['selected_answers']);
$score = $performance['score'];
$score_with_negative = $performance['score_with_negative'];
$right_answers = $performance['right_answers'];
$wrong_answers = $performance['wrong_answers'];
$unanswered = $performance['unanswered'];
$time_used_seconds = $performance['time_used_seconds'];
$time_left_seconds = $performance['time_left_seconds'];

$stmt = $conn->prepare("INSERT INTO performance (subject_id, lesson_id, topic_id, exam_id, attempt_number, selected_answers, score, score_with_negative, right_answers, wrong_answers, unanswered, time_used_seconds, time_left_seconds) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");

$stmt->bind_param("iiiiisddiiiii", 
    $subject_id, 
    $lesson_id, 
    $topic_id,
    $exam_id, 
    $new_attempt_number,
    $selected_answers_json,
    $score,
    $score_with_negative,
    $right_answers,
    $wrong_answers,
    $unanswered,
    $time_used_seconds,
    $time_left_seconds
);

if ($stmt->execute()) {
    $new_attempt_id = $conn->insert_id;
    $performance['attempt_id'] = $new_attempt_id;
    $performance['attempt_number'] = $new_attempt_number;
    $performance['attempt_time'] = date('Y-m-d H:i:s');

    // ✅ Log the submission activity
    $exam_title = $exam_details['exam_title'] ?? 'Unknown Exam';
    log_activity($conn, 'boss_exam_completion', "Exam '{$exam_title}' submitted with score {$score_with_negative}");

    // --- NEW: Update Subject Discipline Tracking ---
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
    $update_subject->bind_param("i", $subject_id);
    $update_subject->execute();
    $update_subject->close();

    // --- NEW: Update Spaced Repetition (SRS) Tracking ---
    $srs_upsert = $conn->prepare("
        INSERT INTO question_srs (question_id, question_text_hash, next_review_at, interval_days, consecutive_correct)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            question_id = VALUES(question_id),
            next_review_at = VALUES(next_review_at),
            interval_days = VALUES(interval_days),
            consecutive_correct = VALUES(consecutive_correct)
    ");

    $q_stmt = $conn->prepare("SELECT id, question, answer FROM questions WHERE exam_id = ? AND is_deleted = 0");
    $q_stmt->bind_param("i", $exam_id);
    $q_stmt->execute();
    $questions_result = $q_stmt->get_result();

    $insert_attempt_stmt = $conn->prepare("INSERT INTO question_attempts (question_id, exam_id, selected_answer, is_correct) VALUES (?, ?, ?, ?)");
    $selected_answers = $performance['selected_answers'];

    while ($q_row = $questions_result->fetch_assoc()) {
        $qid = $q_row['id'];
        $correct_answer = $q_row['answer'];
        $q_text = trim($q_row['question']);
        $q_hash = md5($q_text);

        $selected = isset($selected_answers[$qid]) ? $selected_answers[$qid] : null;
        $is_correct = ($selected !== null && $selected === $correct_answer) ? 1 : 0;

        // Insert attempt record
        $insert_attempt_stmt->bind_param("iisi", $qid, $exam_id, $selected, $is_correct);
        $insert_attempt_stmt->execute();

        // SRS Calculation
        if ($selected !== null) {
            // Get current SRS state for this question (BY HASH)
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
                
                // Interval sequence: 1d -> 3d -> 7d
                if ($new_consecutive === 1) $new_interval = 1;
                elseif ($new_consecutive === 2) $new_interval = 3;
                else $new_interval = 7; 
            } else {
                // Wrong answer resets the scale
                $new_consecutive = 0;
                $new_interval = 1;
            }

            // Schedule at midnight of the target day, not 24h from now
            $next_review = date('Y-m-d 00:00:00', strtotime("+$new_interval days"));
            $srs_upsert->bind_param("issii", $qid, $q_hash, $next_review, $new_interval, $new_consecutive);
            $srs_upsert->execute();
        }
    }

    $insert_attempt_stmt->close();
    $q_stmt->close();
    $srs_upsert->close();

    // --- NEW: Update Topic Revision Metadata ---
    $exam_info_stmt = $conn->prepare("SELECT topic_id, is_revision FROM exams WHERE id = ?");
    $exam_info_stmt->bind_param("i", $exam_id);
    $exam_info_stmt->execute();
    $exam_info = $exam_info_stmt->get_result()->fetch_assoc();

    if ($exam_info && $exam_info['is_revision'] == 1 && $exam_info['topic_id']) {
        $update_topic_stmt = $conn->prepare("UPDATE topics SET last_revised_at = CURRENT_TIMESTAMP WHERE id = ?");
        $update_topic_stmt->bind_param("i", $exam_info['topic_id']);
        $update_topic_stmt->execute();
        $update_topic_stmt->close();
    }
    $exam_info_stmt->close();

    echo json_encode([
        'success' => true, 
        'message' => 'Exam submitted successfully.',
        'data' => $performance
    ]);
} else {
    echo json_encode(['success' => false, 'message' => 'Failed to submit exam results: ' . $stmt->error]);
}

$stmt->close();
$conn->close();
?>
