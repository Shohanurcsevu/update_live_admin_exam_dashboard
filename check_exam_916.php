<?php
require_once 'api/subject/db_connect.php';

$exam_id = 916;

$sql = "SELECT e.*, s.subject_name, l.lesson_name, t.topic_name 
        FROM exams e
        LEFT JOIN subjects s ON e.subject_id = s.id
        LEFT JOIN lessons l ON e.lesson_id = l.id
        LEFT JOIN topics t ON e.topic_id = t.id
        WHERE e.id = ?";

$stmt = $conn->prepare($sql);
$stmt->bind_param('i', $exam_id);
$stmt->execute();
$result = $stmt->get_result();
$exam = $result->fetch_assoc();

if ($exam) {
    echo json_encode($exam, JSON_PRETTY_PRINT);
} else {
    echo json_encode(['error' => 'Exam not found'], JSON_PRETTY_PRINT);
}

$stmt->close();
$conn->close();
?>
