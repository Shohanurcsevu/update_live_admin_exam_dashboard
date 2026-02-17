<?php
require_once '../subject/db_connect.php';
header('Content-Type: application/json');

$data = json_decode(file_get_contents('php://input'), true);
$topic_id = isset($data['topic_id']) ? intval($data['topic_id']) : null;

if (!$topic_id) {
    echo json_encode(['success' => false, 'message' => 'Topic ID is required.']);
    exit;
}

$stmt = $conn->prepare("UPDATE topics SET last_revised_at = CURRENT_TIMESTAMP WHERE id = ?");
$stmt->bind_param("i", $topic_id);

if ($stmt->execute()) {
    echo json_encode(['success' => true, 'message' => 'Topic marked as revised.']);
} else {
    echo json_encode(['success' => false, 'message' => 'Failed to update topic.']);
}

$stmt->close();
$conn->close();
?>
