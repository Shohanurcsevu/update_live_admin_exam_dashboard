<?php
// FILE: api/custom-exam/create.php
// Handles requests from the "Builder (from Exams)" page

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

// Get input data
$data = json_decode(file_get_contents("php://input"), true);

if (empty($data['new_exam_details']) || empty($data['source_exams']) || !is_array($data['source_exams'])) {
    echo json_encode(['success' => false, 'message' => 'Missing required data.']);
    exit;
}

$new_exam = $data['new_exam_details'];
$source_exams = $data['source_exams'];

$conn->begin_transaction();

try {
    // Insert exam
    $stmt = $conn->prepare("INSERT INTO exams (subject_id, lesson_id, topic_id, exam_title, duration, instructions, total_marks, pass_mark, negative_mark_value)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0.5)");
    $stmt->bind_param("iiisissd",
        $new_exam['subject_id'], $new_exam['lesson_id'], $new_exam['topic_id'],
        $new_exam['exam_title'], $new_exam['duration'], $new_exam['instructions'],
        $new_exam['total_marks'], $new_exam['pass_mark']
    );
    $stmt->execute();
    $new_exam_id = $conn->insert_id;
    if ($new_exam_id == 0) throw new Exception("Failed to create exam entry.");
    $stmt->close();

    // Prepare question insert
    $insert_q_stmt = $conn->prepare("INSERT INTO questions (subject_id, lesson_id, topic_id, exam_id, question, options, answer, explanation)
                                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)");

    $used_question_ids = [];

    foreach ($source_exams as $source) {
        $source_exam_id = intval($source['exam_id']);
        $question_count = intval($source['question_count']);

        if ($question_count > 0) {
            $fetch_sql = "SELECT id, subject_id, lesson_id, topic_id, question, options, answer, explanation
                          FROM questions WHERE exam_id = ?";
            $fetch_params = [$source_exam_id];
            $fetch_types = "i";

            // Exclude already used
            if (!empty($used_question_ids)) {
                $placeholders = implode(',', array_fill(0, count($used_question_ids), '?'));
                $fetch_sql .= " AND id NOT IN ($placeholders)";
                foreach ($used_question_ids as $id) {
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
                $used_question_ids[] = $q_row['id'];
                $insert_q_stmt->bind_param("iiiissss",
                    $q_row['subject_id'], $q_row['lesson_id'], $q_row['topic_id'],
                    $new_exam_id, $q_row['question'], $q_row['options'],
                    $q_row['answer'], $q_row['explanation']
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
    $topic_name   = get_name_by_id($conn, 'topics',   $new_exam['topic_id'],   'topic_name')   ?: 'N/A';

    $log_message = "A model test titled '{$new_exam['exam_title']}' was created (Subject: '{$subject_name}', Lesson: '{$lesson_name}', Topic: '{$topic_name}').";
    log_activity($conn, 'Exam from Exam Created', $log_message);

    $conn->commit();
    echo json_encode(['success' => true, 'message' => 'Custom model test created successfully!']);
} catch (Exception $e) {
    $conn->rollback();
    echo json_encode(['success' => false, 'message' => 'Error: ' . $e->getMessage()]);
}

$conn->close();
?>
