<?php
// --- DEBUGGING: Start logging ---
error_log("--- Custom Exam from Lessons API START ---");

require_once '../subject/db_connect.php';

$data = json_decode(file_get_contents("php://input"), true);

// --- DEBUGGING: Log incoming data ---
error_log("Received data: " . json_encode($data, JSON_PRETTY_PRINT));


if (empty($data['new_exam_details']) || empty($data['source_lessons']) || !is_array($data['source_lessons'])) {
    error_log("Validation failed: Missing required exam details or source lessons.");
    echo json_encode(['success' => false, 'message' => 'Missing required exam details or source lessons.']);
    exit;
}

$new_exam = $data['new_exam_details'];
$source_lessons = $data['source_lessons'];

$conn->begin_transaction();

try {
    // 1. Create the new custom exam entry.
    $stmt = $conn->prepare("INSERT INTO exams (subject_id, lesson_id, topic_id, exam_title, duration, instructions, total_marks, pass_mark, negative_mark_value) VALUES (?, NULL, NULL, ?, ?, ?, ?, ?, 0.5)");
    $stmt->bind_param("isissd", 
        $new_exam['subject_id'], 
        $new_exam['exam_title'], 
        $new_exam['duration'], 
        $new_exam['instructions'], 
        $new_exam['total_marks'], 
        $new_exam['pass_mark']
    );
    $stmt->execute();
    $new_exam_id = $conn->insert_id;
    if ($new_exam_id == 0) throw new Exception("Failed to create the new exam entry. insert_id was 0.");
    $stmt->close();
    
    // --- DEBUGGING: Log new exam ID ---
    error_log("Successfully created new exam with ID: " . $new_exam_id);


    // 2. Prepare the INSERT statement for questions.
    $insert_q_stmt = $conn->prepare("INSERT INTO questions (subject_id, lesson_id, topic_id, exam_id, question, options, answer, explanation) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    
    $q_subject_id = 0; $q_lesson_id = 0; $q_topic_id = 0;
    $q_question = ''; $q_options = ''; $q_answer = ''; $q_explanation = '';
    
    $insert_q_stmt->bind_param("iiiissss", $q_subject_id, $q_lesson_id, $q_topic_id, $new_exam_id, $q_question, $q_options, $q_answer, $q_explanation);

    // 3. Loop through the source lessons to fetch and insert questions.
    foreach ($source_lessons as $source) {
        $source_lesson_id = intval($source['lesson_id']);
        $question_count = intval($source['question_count']);

        // --- DEBUGGING: Log each source being processed ---
        error_log("Processing source lesson ID: {$source_lesson_id}, attempting to fetch {$question_count} questions.");

        if ($question_count > 0) {
            $fetch_q_stmt = $conn->prepare("SELECT subject_id, topic_id, question, options, answer, explanation FROM questions WHERE lesson_id = ? ORDER BY RAND() LIMIT ?");
            $fetch_q_stmt->bind_param("ii", $source_lesson_id, $question_count);
            $fetch_q_stmt->execute();
            $questions_result = $fetch_q_stmt->get_result();
            
            // --- DEBUGGING: Log how many questions were found ---
            error_log("Found " . $questions_result->num_rows . " questions for lesson ID {$source_lesson_id}.");

            while ($q_row = $questions_result->fetch_assoc()) {
                // Update the bound variables
                $q_subject_id = $q_row['subject_id'];
                $q_lesson_id = $source_lesson_id;
                $q_topic_id = $q_row['topic_id'];
                $q_question = $q_row['question'];
                $q_options = $q_row['options'];
                $q_answer = $q_row['answer'];
                $q_explanation = $q_row['explanation'];

                // --- DEBUGGING: Log before each insert ---
                error_log("Attempting to insert question: '{$q_question}' into exam ID {$new_exam_id}.");

                if (!$insert_q_stmt->execute()) {
                    // If a single insert fails, throw an exception to trigger the rollback.
                    throw new Exception("Failed to insert question. MySQL Error: " . $insert_q_stmt->error);
                }
            }
            $fetch_q_stmt->close();
        }
    }
    $insert_q_stmt->close();

    $conn->commit();
    error_log("--- Transaction COMMITTED successfully. ---");
    echo json_encode(['success' => true, 'message' => 'Custom exam from lessons created successfully!']);

} catch (Exception $e) {
    $conn->rollback();
    // --- DEBUGGING: Log the specific exception message ---
    error_log("--- EXCEPTION CAUGHT, TRANSACTION ROLLED BACK ---");
    error_log("Error: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'An error occurred during exam creation: ' . $e->getMessage()]);
}

$conn->close();
?>
