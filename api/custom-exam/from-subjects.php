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
    $insert_q_stmt = $conn->prepare("INSERT INTO questions (subject_id, lesson_id, topic_id, exam_id, question, options, answer, explanation, priority, original_question_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");

    
    $q_subject_id = 0; $q_lesson_id = 0; $q_topic_id = 0;
    $q_question = ''; $q_options = ''; $q_answer = ''; $q_explanation = ''; $q_priority = 0; $q_original_id = 0;
    
    $insert_q_stmt->bind_param("iiiissssii", $q_subject_id, $q_lesson_id, $q_topic_id, $new_exam_id, $q_question, $q_options, $q_answer, $q_explanation, $q_priority, $q_original_id);


    // 3. Loop through the source lessons to fetch and insert questions.
    $all_fetched_question_ids = [];

    foreach ($source_lessons as $source) {
        $source_lesson_id = intval($source['lesson_id']);
        $question_count = intval($source['question_count']);

        // --- DEBUGGING: Log each source being processed ---
        error_log("Processing source lesson ID: {$source_lesson_id}, attempting to fetch {$question_count} questions.");

        if ($question_count > 0) {
            $fetch_sql = "SELECT q.id, q.subject_id, q.topic_id, q.question, q.options, q.answer, q.explanation, q.priority, COUNT(qa.id) AS attempt_count 
                          FROM questions q 
                          LEFT JOIN question_attempts qa ON q.id = qa.question_id 
                          WHERE q.lesson_id = ? AND q.is_deleted = 0 AND q.original_question_id IS NULL";

            $fetch_params = [$source_lesson_id];
            $fetch_types = "i";

            // Cross-lesson deduplication
            if (!empty($all_fetched_question_ids)) {
                $placeholders = str_repeat('?,', count($all_fetched_question_ids) - 1) . '?';
                $fetch_sql .= " AND q.id NOT IN ($placeholders)";
                foreach ($all_fetched_question_ids as $id) {
                    $fetch_params[] = $id;
                    $fetch_types .= 'i';
                }
            }

            // Priority levels filter
            if (!empty($data['priority_levels'])) {
                $priority_placeholders = implode(',', array_fill(0, count($data['priority_levels']), '?'));
                $fetch_sql .= " AND priority IN ($priority_placeholders)";
                foreach ($data['priority_levels'] as $p) {
                    $fetch_params[] = intval($p);
                    $fetch_types .= 'i';
                }
            }

            $fetch_sql .= " GROUP BY q.id ORDER BY attempt_count ASC, RAND() LIMIT ?";
            $fetch_params[] = $question_count;
            $fetch_types .= 'i';

            $fetch_q_stmt = $conn->prepare($fetch_sql);
            $fetch_q_stmt->bind_param($fetch_types, ...$fetch_params);
            $fetch_q_stmt->execute();
            $questions_result = $fetch_q_stmt->get_result();
            
            // --- DEBUGGING: Log how many questions were found ---
            error_log("Found " . $questions_result->num_rows . " questions for lesson ID {$source_lesson_id}.");

            while ($q_row = $questions_result->fetch_assoc()) {
                $all_fetched_question_ids[] = $q_row['id'];

                // Update the bound variables
                $q_subject_id = $q_row['subject_id'];
                $q_lesson_id = $source_lesson_id;
                $q_topic_id = $q_row['topic_id'];
                $q_question = $q_row['question'];
                $q_options = $q_row['options'];
                $q_answer = $q_row['answer'];
                $q_explanation = $q_row['explanation'];
                $q_priority = $q_row['priority'];
                $q_original_id = $q_row['id'];


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
