<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *'); // Consider restricting this in production for security
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
require_once '../subject/db_connect.php';

$lesson_id = isset($_GET['lesson_id']) ? intval($_GET['lesson_id']) : 0;

if ($lesson_id === 0) {
    echo json_encode(['success' => true, 'data' => []]);
    exit;
}

$stmt = $conn->prepare("SELECT id, topic_name FROM topics WHERE lesson_id = ? AND is_deleted = 0 ORDER BY id ASC");
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
