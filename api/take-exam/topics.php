<?php
// FILE: api/take-exam/topics.php
require_once '../subject/db_connect.php';
$lesson_id = isset($_GET['lesson_id']) ? intval($_GET['lesson_id']) : 0;
if ($lesson_id === 0) { echo json_encode(['success' => true, 'data' => []]); exit; }
$stmt = $conn->prepare("SELECT id, topic_name FROM topics WHERE lesson_id = ? ORDER BY id ASC");
$stmt->bind_param("i", $lesson_id);
$stmt->execute();
$result = $stmt->get_result();
$topics = [];
while($row = $result->fetch_assoc()) { $topics[] = $row; }
echo json_encode(['success' => true, 'data' => $topics]);
$stmt->close();
$conn->close();
?>