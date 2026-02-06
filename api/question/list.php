<?php
require_once '../subject/db_connect.php';

if (empty($_GET['exam_id'])) {
    echo json_encode(['success' => false, 'message' => 'Exam ID is required.']);
    exit;
}

$exam_id = intval($_GET['exam_id']);

$stmt = $conn->prepare("SELECT * FROM questions WHERE exam_id = ? AND is_deleted = 0 ORDER BY id ASC");
$stmt->bind_param("i", $exam_id);
$stmt->execute();
$result = $stmt->get_result();

$questions = [];
while ($row = $result->fetch_assoc()) {
    // Decode the JSON options string into a PHP array/object
    $row['options'] = json_decode($row['options']); 
    $questions[] = $row;
}

echo json_encode(['success' => true, 'data' => $questions]);
$stmt->close();
$conn->close();
?>
