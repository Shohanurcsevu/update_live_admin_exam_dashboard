<?php
require_once '../subject/db_connect.php';

$data = json_decode(file_get_contents("php://input"), true);

if (empty($data['new_exam_details']) || empty($data['source_exams']) || !is_array($data['source_exams'])) {
    echo json_encode(['success' => false, 'message' => 'Missing required exam details or source exams.']);
    exit;
}

$new_exam = $data['new_exam_details'];
$source_exams = $data['source_exams'];

$conn->begin_transaction();

try {
    // Function to get name from table by id
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

    // Function to log activity
    function log_activity($conn, $type, $message) {
        $stmt = $conn->prepare("INSERT INTO activity_log (activity_type, activity_message) VALUES (?, ?)");
        $stmt->bind_param("ss", $type, $message);
        $stmt->execute();
        $stmt->close();
    }

    // 1. Create the new custom exam entry
    $stmt = $conn->prepare("INSERT INTO exams (subject_id, lesson_id, topic_id, exam_title, duration, instructions, total_marks, pass_mark, negative_mark_value) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0.5)");
    $stmt->bind_param("iiisissd", 
        $new_exam['subject_id'], 
        $new_exam['lesson_id'], 
        $new_exam['topic_id'], 
        $new_exam['exam_title'], 
        $new_exam['duration'], 
        $new_exam['instructions'], 
        $new_exam['total_marks'], 
        $new_exam['pass_mark']
    );
    $stmt->execute();
    $new_exam_id = $conn->insert_id;
    if ($new_exam_id == 0) throw new Exception("Failed to create new exam entry.");
    $stmt->close();

    // 2. Prepare statement for inserting questions
    $insert_q_stmt = $conn->prepare("INSERT INTO questions (subject_id, lesson_id, topic_id, exam_id, question, options, answer, explanation) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");

    // 3. Fetch random questions from sources and insert them for the new exam
    foreach ($source_exams as $source) {
        $source_exam_id = intval($source['exam_id']);
        $question_count = intval($source['question_count']);

        if ($question_count > 0) {
            $fetch_q_stmt = $conn->prepare("SELECT question, options, answer, explanation FROM questions WHERE exam_id = ? ORDER BY RAND() LIMIT ?");
            $fetch_q_stmt->bind_param("ii", $source_exam_id, $question_count);
            $fetch_q_stmt->execute();
            $questions_result = $fetch_q_stmt->get_result();
            
            while ($q_row = $questions_result->fetch_assoc()) {
                $insert_q_stmt->bind_param("iiiissss",
                    $new_exam['subject_id'],
                    $new_exam['lesson_id'],
                    $new_exam['topic_id'],
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

    // ✅ Log creation activity
    $subject_name = get_name_by_id($conn, 'subjects', $new_exam['subject_id'], 'subject_name');
    $lesson_name = get_name_by_id($conn, 'lessons', $new_exam['lesson_id'], 'lesson_name');
    $topic_name  = get_name_by_id($conn, 'topics',  $new_exam['topic_id'], 'topic_name');

    $log_message = "A Exam from  exam titled '" . $new_exam['exam_title'] . "' was created (Subject: '" . $subject_name . "', Lesson: '" . $lesson_name . "', Topic: '" . $topic_name . "').";

    log_activity($conn, 'Exam from Exam Created', $log_message);

    $conn->commit();
    echo json_encode(['success' => true, 'message' => 'Custom exam created successfully!']);

} catch (Exception $e) {
    $conn->rollback();
    echo json_encode(['success' => false, 'message' => 'An error occurred: ' . $e->getMessage()]);
}

$conn->close();
?>
