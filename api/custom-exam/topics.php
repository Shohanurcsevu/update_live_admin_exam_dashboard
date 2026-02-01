<?php
require_once '../subject/db_connect.php';

$lesson_id = isset($_GET['lesson_id']) ? intval($_GET['lesson_id']) : 0;

if ($lesson_id === 0) {
    echo json_encode(['success' => true, 'data' => []]);
    exit;
}

// Select topics and count how many questions each one has, only returning topics with at least 1 question.
$stmt = $conn->prepare("
    SELECT t.id, t.topic_name, COUNT(q.id) as total_questions 
    FROM topics t
    JOIN questions q ON t.id = q.topic_id
    WHERE t.lesson_id = ?
    GROUP BY t.id, t.topic_name
    HAVING total_questions > 0
    ORDER BY t.topic_name ASC
");
$stmt->bind_param("i", $lesson_id);
$stmt->execute();
$result = $stmt->get_result();

$topics = [];
while($row = $result->fetch_assoc()) {
    $topics[] = $row;
}

echo json_encode(['success' => true, 'data' => $topics]);
$stmt->close();
$conn->close();
?>
