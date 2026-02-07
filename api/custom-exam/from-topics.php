<?php
// FILE: api/custom-exam/from-topics.php
// Handles requests from the "Builder (from Topics)" page.

require_once '../subject/db_connect.php';

// Utility: log activity
function log_activity($conn, $type, $message) {
    $stmt = $conn->prepare("INSERT INTO activity_log (activity_type, activity_message) VALUES (?, ?)");
    $stmt->bind_param("ss", $type, $message);
    $stmt->execute();
    $stmt->close();
}

// Utility: get name by id
function get_name_by_id($conn, $table, $id, $column) {
    $stmt = $conn->prepare("SELECT $column FROM $table WHERE id = ?");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $result = $stmt->get_result();
    $name = '';
    if ($result->num_rows > 0) {
        $row = $result->fetch_assoc();
        $name = $row[$column];
    }
    $stmt->close();
    return $name;
}

// Input validation
$data = json_decode(file_get_contents("php://input"), true);
if (empty($data['new_exam_details']) || empty($data['source_topics']) || !is_array($data['source_topics'])) {
    echo json_encode(['success' => false, 'message' => 'Missing required data.']);
    exit;
}

$new_exam = $data['new_exam_details'];
$source_topics = $data['source_topics'];

$conn->begin_transaction();

try {
    // Insert exam record
    $stmt = $conn->prepare("INSERT INTO exams (subject_id, lesson_id, topic_id, exam_title, duration, instructions, total_marks, pass_mark, negative_mark_value) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, 0.5)");
    $stmt->bind_param("iisissd",
        $new_exam['subject_id'],
        $new_exam['lesson_id'],
        $new_exam['exam_title'],
        $new_exam['duration'],
        $new_exam['instructions'],
        $new_exam['total_marks'],
        $new_exam['pass_mark']
    );
    $stmt->execute();
    $new_exam_id = $conn->insert_id;
    if ($new_exam_id == 0) throw new Exception("Failed to create exam entry.");
    $stmt->close();

    // Insert selected questions
    $insert_q_stmt = $conn->prepare("INSERT INTO questions (subject_id, lesson_id, topic_id, exam_id, question, options, answer, explanation) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    $all_fetched_question_ids = [];

    foreach ($source_topics as $source) {
        $source_topic_id = intval($source['topic_id']);
        $question_count = intval($source['question_count']);

        if ($question_count > 0) {
            $fetch_sql = "SELECT id, subject_id, lesson_id, question, options, answer, explanation FROM questions WHERE topic_id = ?";
            $fetch_params = [$source_topic_id];
            $fetch_types = "i";

            if (!empty($all_fetched_question_ids)) {
                $placeholders = implode(',', array_fill(0, count($all_fetched_question_ids), '?'));
                $fetch_sql .= " AND id NOT IN ($placeholders)";
                foreach ($all_fetched_question_ids as $id) {
                    $fetch_params[] = $id;
                    $fetch_types .= 'i';
                }
            }

            $fetch_sql .= " ORDER BY RAND() LIMIT ?";
            $fetch_params[] = $question_count;
            $fetch_types .= 'i';

            $fetch_q_stmt = $conn->prepare($fetch_sql);
            $fetch_q_stmt->bind_param($fetch_types, ...$fetch_params);
            $fetch_q_stmt->execute();
            $questions_result = $fetch_q_stmt->get_result();

            while ($q_row = $questions_result->fetch_assoc()) {
                $all_fetched_question_ids[] = $q_row['id'];
                $insert_q_stmt->bind_param("iiiissss",
                    $q_row['subject_id'],
                    $q_row['lesson_id'],
                    $source_topic_id,
                    $new_exam_id,
                    $q_row['question'],
                    $q_row['options'],
                    $q_row['answer'],
                    $q_row['explanation']
                );
                $insert_q_stmt->execute();
            }

            $fetch_q_stmt->close();
        }
    }

    $insert_q_stmt->close();

    // ✅ Log Activity
    $subject_name = get_name_by_id($conn, 'subjects', $new_exam['subject_id'], 'subject_name') ?: 'N/A';
    $lesson_name  = get_name_by_id($conn, 'lessons',  $new_exam['lesson_id'],  'lesson_name')  ?: 'N/A';
    $topic_titles = [];

    foreach ($source_topics as $src) {
        $topic_titles[] = get_name_by_id($conn, 'topics', $src['topic_id'], 'topic_name') ?: 'Topic-ID: '.$src['topic_id'];
    }

    $log_message = "A topic-based model test titled '{$new_exam['exam_title']}' was created (Subject: '{$subject_name}', Lesson: '{$lesson_name}', Topics: " . implode(', ', $topic_titles) . ").";
    log_activity($conn, 'Exam from Topics Created', $log_message);

    $conn->commit();
    echo json_encode(['success' => true, 'message' => 'Custom exam from topics created successfully!']);
} catch (Exception $e) {
    $conn->rollback();
    echo json_encode(['success' => false, 'message' => 'An error occurred: ' . $e->getMessage()]);
}

$conn->close();
?>
