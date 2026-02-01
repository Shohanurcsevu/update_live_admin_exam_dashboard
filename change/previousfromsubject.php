<?php
require_once '../subject/db_connect.php';

$data = json_decode(file_get_contents("php://input"), true);

if (empty($data['new_exam_details']) || empty($data['source_lessons']) || !is_array($data['source_lessons'])) {
    echo json_encode(['success' => false, 'message' => 'Missing required exam details or source lessons.']);
    exit;
}

$new_exam = $data['new_exam_details'];
$source_lessons = $data['source_lessons'];

$conn->begin_transaction();

try {
    // 1. Create the new custom exam entry with NULL for subject, lesson, and topic
    $stmt = $conn->prepare("INSERT INTO exams (subject_id, lesson_id, topic_id, exam_title, duration, instructions, total_marks, pass_mark, negative_mark_value) VALUES (NULL, NULL, NULL, ?, ?, ?, ?, ?, 0.5)");
    $stmt->bind_param("sissd", 
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

    // 3. Fetch random questions and insert them
    foreach ($source_lessons as $source) {
        $source_lesson_id = intval($source['lesson_id']);
        $question_count = intval($source['question_count']);

        if ($question_count > 0) {
            $fetch_q_stmt = $conn->prepare("SELECT subject_id, topic_id, question, options, answer, explanation FROM questions WHERE lesson_id = ? ORDER BY RAND() LIMIT ?");
            $fetch_q_stmt->bind_param("ii", $source_lesson_id, $question_count);
            $fetch_q_stmt->execute();
            $questions_result = $fetch_q_stmt->get_result();
            
            while ($q_row = $questions_result->fetch_assoc()) {
                $insert_q_stmt->bind_param("iiiissss",
                    $q_row['subject_id'],
                    $source_lesson_id,
                    $q_row['topic_id'],
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

    $conn->commit();
    echo json_encode(['success' => true, 'message' => 'Subject-level model test created successfully!']);

} catch (Exception $e) {
    $conn->rollback();
    echo json_encode(['success' => false, 'message' => 'An error occurred: ' . $e->getMessage()]);
}

$conn->close();
?>
