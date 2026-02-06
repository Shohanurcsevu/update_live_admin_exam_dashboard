<?php
// FILE: api/take-exam/start.php (Corrected)
// This file is called when you click "Take Exam".

require_once '../subject/db_connect.php';
if (empty($_GET['exam_id'])) { 
    echo json_encode(['success' => false, 'message' => 'Exam ID required.']); 
    exit; 
}
$exam_id = intval($_GET['exam_id']);

// --- MODIFIED: Changed JOINs to LEFT JOINs to support exams with NULL topic_id ---
$exam_sql = "SELECT e.*, s.subject_name, l.lesson_name, t.topic_name 
             FROM exams e 
             LEFT JOIN subjects s ON e.subject_id = s.id 
             LEFT JOIN lessons l ON e.lesson_id = l.id 
             LEFT JOIN topics t ON e.topic_id = t.id 
             WHERE e.id = ? AND e.is_deleted = 0";

$stmt = $conn->prepare($exam_sql);
$stmt->bind_param("i", $exam_id);
$stmt->execute();
$exam_details = $stmt->get_result()->fetch_assoc();

if (!$exam_details) { 
    echo json_encode(['success' => false, 'message' => 'Exam not found.']); 
    exit; 
}

$question_sql = "SELECT id, question, options, answer FROM questions WHERE exam_id = ? AND is_deleted = 0";
$stmt = $conn->prepare($question_sql);
$stmt->bind_param("i", $exam_id);
$stmt->execute();
$result = $stmt->get_result();
$questions = [];
while ($row = $result->fetch_assoc()) {
    $row['options'] = json_decode($row['options'], true);
    $questions[] = $row;
}

echo json_encode(['success' => true, 'data' => ['details' => $exam_details, 'questions' => $questions]]);
$stmt->close();
$conn->close();
?>