<?php
require_once 'api/subject/db_connect.php';

$topic_id = 17;
$stmt = $conn->prepare("
    SELECT q.id, q.exam_id, q.is_deleted, e.is_deleted as exam_is_deleted 
    FROM questions q 
    LEFT JOIN exams e ON q.exam_id = e.id 
    WHERE q.topic_id = ?
");
$stmt->bind_param("i", $topic_id);
$stmt->execute();
$result = $stmt->get_result();
$rows = [];
while ($row = $result->fetch_assoc()) {
    $rows[] = $row;
}
echo json_encode($rows, JSON_PRETTY_PRINT);
$stmt->close();
$conn->close();
?>
