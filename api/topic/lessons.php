<?php
require_once '../subject/db_connect.php';

$subject_id = isset($_GET['subject_id']) ? intval($_GET['subject_id']) : 0;

if ($subject_id === 0) {
    echo json_encode(['success' => true, 'data' => []]);
    exit;
}

$stmt = $conn->prepare("SELECT id, lesson_name FROM lessons WHERE subject_id = ? ORDER BY id ASC");
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
