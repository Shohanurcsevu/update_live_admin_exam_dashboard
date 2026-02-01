<?php
require_once '../subject/db_connect.php';

$subject_id = isset($_GET['subject_id']) ? intval($_GET['subject_id']) : 0;

if ($subject_id === 0) {
    echo json_encode(['success' => true, 'data' => []]);
    exit;
}

// Select lessons and count how many questions each one has, only returning lessons with at least 1 question.
$stmt = $conn->prepare("
    SELECT l.id, l.lesson_name, l.py_bcs_ques, COUNT(q.id) as total_questions 
    FROM lessons l
    LEFT JOIN questions q ON l.id = q.lesson_id
    WHERE l.subject_id = ?
    GROUP BY l.id
    HAVING total_questions > 0
    ORDER BY l.lesson_name ASC
");
$stmt->bind_param("i", $subject_id);
$stmt->execute();
$result = $stmt->get_result();

$lessons = [];
while($row = $result->fetch_assoc()) {
    $lessons[] = $row;
}

echo json_encode(['success' => true, 'data' => $lessons]);
$stmt->close();
$conn->close();
?>
