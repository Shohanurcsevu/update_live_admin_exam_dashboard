<?php
require_once '../subject/db_connect.php';

// --- MODIFIED: Replaced the single complex query with a more robust, multi-step approach ---

// 1. Get all subjects first
$subjects_result = $conn->query("SELECT id as subject_id, subject_name FROM subjects ORDER BY subject_name ASC");
$response_data = [];

if ($subjects_result) {
    while ($subject_row = $subjects_result->fetch_assoc()) {
        $subject_id = $subject_row['subject_id'];
        
        // Prepare a new structure for the current subject
        $current_subject = [
            'subject_id' => $subject_id,
            'subject_name' => $subject_row['subject_name'],
            'lessons' => []
        ];

        // 2. For each subject, run a separate query to get its lessons and their question counts
        $lesson_stmt = $conn->prepare("
            SELECT 
                l.id as lesson_id, 
                l.lesson_name, 
                l.py_bcs_ques, 
                COUNT(q.id) as total_questions
            FROM lessons l
            LEFT JOIN questions q ON l.id = q.lesson_id
            WHERE l.subject_id = ?
            GROUP BY l.id
            ORDER BY l.lesson_name ASC
        ");
        $lesson_stmt->bind_param("i", $subject_id);
        $lesson_stmt->execute();
        $lessons_result = $lesson_stmt->get_result();

        // 3. Add all found lessons to the current subject's 'lessons' array
        while ($lesson_row = $lessons_result->fetch_assoc()) {
            // Only add lessons that actually have questions, as per the original requirement
            if ($lesson_row['total_questions'] > 0) {
                $current_subject['lessons'][] = $lesson_row;
            }
        }
        $lesson_stmt->close();
        
        // Add the fully processed subject to our final response array
        $response_data[] = $current_subject;
    }
}

echo json_encode(['success' => true, 'data' => $response_data]);
$conn->close();
?>
