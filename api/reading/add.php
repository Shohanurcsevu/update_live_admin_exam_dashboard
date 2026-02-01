<?php
require_once '../subject/db_connect.php'; // Reuse the existing connection file

$data = json_decode(file_get_contents("php://input"), true);

if (empty($data['subject_id']) || empty($data['read_date']) || !isset($data['pages_read'])) {
    echo json_encode(['success' => false, 'message' => 'Missing required fields.']);
    exit;
}

$subject_id = intval($data['subject_id']);
$read_date = $data['read_date'];
$pages_read = intval($data['pages_read']);

// Use INSERT ... ON DUPLICATE KEY UPDATE to handle both new and existing entries for a given day
$stmt = $conn->prepare("INSERT INTO reading_logs (subject_id, read_date, pages_read) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE pages_read = VALUES(pages_read)");

$stmt->bind_param("isi", $subject_id, $read_date, $pages_read);

if ($stmt->execute()) {
    echo json_encode(['success' => true, 'message' => 'Reading log saved successfully.']);
} else {
    echo json_encode(['success' => false, 'message' => 'Error saving reading log: ' . $stmt->error]);
}

$stmt->close();
$conn->close();
?>
