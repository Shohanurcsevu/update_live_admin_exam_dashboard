<?php
require_once '../subject/db_connect.php';

$data = json_decode(file_get_contents("php://input"), true);

if (empty($data['id'])) {
    echo json_encode(['success' => false, 'message' => 'Question ID is required.']);
    exit;
}

$id = intval($data['id']);

// Optional: fetch question info before deleting for logging
$stmt_fetch = $conn->prepare("SELECT question FROM questions WHERE id = ?");
$stmt_fetch->bind_param("i", $id);
$stmt_fetch->execute();
$result = $stmt_fetch->get_result();
if ($result->num_rows === 0) {
    echo json_encode(['success' => false, 'message' => 'Question not found.']);
    exit;
}
$row = $result->fetch_assoc();
$question_text = $row['question'];
$stmt_fetch->close();

$stmt = $conn->prepare("UPDATE questions SET is_deleted = 1 WHERE id = ?");
$stmt->bind_param("i", $id);

function log_activity($conn, $type, $message) {
    $stmt_log = $conn->prepare("INSERT INTO activity_log (activity_type, activity_message) VALUES (?, ?)");
    $stmt_log->bind_param("ss", $type, $message);
    $stmt_log->execute();
    $stmt_log->close();
}

if ($stmt->execute()) {
    // Log deletion message with truncated question text
    $msg = "Question ID $id deleted. Text: '" . substr($question_text, 0, 50) . (strlen($question_text) > 50 ? "..." : "") . "'";
    log_activity($conn, 'Question Deleted', $msg);

    echo json_encode(['success' => true, 'message' => 'Question deleted successfully.']);
} else {
    echo json_encode(['success' => false, 'message' => 'Failed to delete question.']);
}

$stmt->close();
$conn->close();
?>
