<?php
if (!function_exists('insert_questions')) {
    function insert_questions($conn, $exam_id, $questions) {
        if (empty($questions) || !is_array($questions)) {
            return ['success' => true, 'message' => 'No questions to insert.'];
        }

        // First, get subject_id, lesson_id, topic_id, and exam_title from the exam
        $exam_stmt = $conn->prepare("SELECT subject_id, lesson_id, topic_id, exam_title FROM exams WHERE id = ?");
        $exam_stmt->bind_param("i", $exam_id);
        $exam_stmt->execute();
        $exam_result = $exam_stmt->get_result();
        if ($exam_result->num_rows === 0) {
            return ['success' => false, 'message' => 'Exam not found.'];
        }
        $exam_details = $exam_result->fetch_assoc();
        $exam_stmt->close();

        $subject_id = $exam_details['subject_id'];
        $lesson_id = $exam_details['lesson_id'];
        $topic_id = $exam_details['topic_id'];
        $exam_title = $exam_details['exam_title'];

        // Helper to get names for logging
        $get_name = function($table, $id, $column) use ($conn) {
            $stmt = $conn->prepare("SELECT $column FROM $table WHERE id = ?");
            $stmt->bind_param("i", $id);
            $stmt->execute();
            $result = $stmt->get_result();
            $name = ($result->num_rows > 0) ? $result->fetch_assoc()[$column] : '';
            $stmt->close();
            return $name;
        };

        $subject_name = $get_name('subjects', $subject_id, 'subject_name');
        $lesson_name = $get_name('lessons', $lesson_id, 'lesson_name');
        $topic_name = $get_name('topics', $topic_id, 'topic_name');

        // Prepare statement for inserting questions
        $stmt = $conn->prepare("INSERT INTO questions (subject_id, lesson_id, topic_id, exam_id, question, options, answer, explanation, priority) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");

        foreach ($questions as $index => $q) {
            if (empty($q['question']) || empty($q['options']) || !is_array($q['options']) || empty($q['answer'])) {
                $stmt->close();
                return ['success' => false, 'message' => "Import failed: Question #" . ($index + 1) . " is missing a required field."];
            }

            // Sanitize Option E: If E is the answer, move to D. Always remove E.
            if (isset($q['options']['E'])) {
                if ($q['answer'] === 'E') {
                    $q['options']['D'] = $q['options']['E'];
                    $q['answer'] = 'D';
                }
                unset($q['options']['E']);
            }

            $options_json = json_encode($q['options']);
            $explanation = isset($q['explanation']) ? $q['explanation'] : '';
            $priority = isset($q['priority']) ? max(0, intval($q['priority'])) : 0;

            $stmt->bind_param("iiiissssi", $subject_id, $lesson_id, $topic_id, $exam_id, $q['question'], $options_json, $q['answer'], $explanation, $priority);

            if (!$stmt->execute()) {
                $stmt->close();
                return ['success' => false, 'message' => "Database error on question #" . ($index + 1) . ": " . $conn->error];
            }
        }
        $stmt->close();

        // Log activity
        $log_stmt = $conn->prepare("INSERT INTO activity_log (activity_type, activity_message) VALUES (?, ?)");
        $type = 'Questions Imported';
        $message = count($questions) . " questions added to Exam '" . $exam_title . "' (Subject: '" . $subject_name . "', Lesson: '" . $lesson_name . "', Topic: '" . $topic_name . "').";
        $log_stmt->bind_param("ss", $type, $message);
        $log_stmt->execute();
        $log_stmt->close();

        // Update Subject Discipline Tracking
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

        return ['success' => true];
    }
}
?>
