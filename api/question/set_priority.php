<?php
require_once '../subject/db_connect.php';

$data = json_decode(file_get_contents("php://input"), true);

if (empty($data['id'])) {
    echo json_encode(['success' => false, 'message' => 'Question ID is required.']);
    exit;
}

$id = intval($data['id']);
$priority = isset($data['priority']) ? max(0, intval($data['priority'])) : 0;

// Fetch current info for logging
$stmt_info = $conn->prepare("
    SELECT q.question, q.priority as old_priority, q.exam_id, e.exam_title 
    FROM questions q 
    JOIN exams e ON q.exam_id = e.id 
    WHERE q.id = ?
");
$stmt_info->bind_param("i", $id);
$stmt_info->execute();
$result_info = $stmt_info->get_result();

if ($result_info->num_rows === 0) {
    echo json_encode(['success' => false, 'message' => 'Question not found.']);
    exit;
}

$row = $result_info->fetch_assoc();
$old_priority = intval($row['old_priority']);
$exam_title = $row['exam_title'];
$question_preview = substr($row['question'], 0, 50) . (strlen($row['question']) > 50 ? "..." : "");
$stmt_info->close();

if ($priority === $old_priority) {
    echo json_encode(['success' => true, 'message' => 'Priority remains unchanged.', 'no_change' => true]);
    exit;
}

$stmt_update = $conn->prepare("UPDATE questions SET priority = ? WHERE id = ?");
$stmt_update->bind_param("ii", $priority, $id);

if ($stmt_update->execute()) {
    // Log activity
    $stmt_log = $conn->prepare("INSERT INTO activity_log (activity_type, activity_message) VALUES (?, ?)");
    $type = 'Question Priority Updated';
    $message = "Priority for question ID {$id} in '{$exam_title}' changed from {$old_priority} to {$priority}. Question: '{$question_preview}'";
    $stmt_log->bind_param("ss", $type, $message);
    $stmt_log->execute();
    $stmt_log->close();

    echo json_encode(['success' => true, 'message' => 'Priority updated successfully.']);
} else {
    echo json_encode(['success' => false, 'message' => 'Failed to update priority.']);
}

$stmt_update->close();
$conn->close();
?>
