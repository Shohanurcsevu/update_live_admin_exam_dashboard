<?php
require_once '../subject/db_connect.php';

/**
 * Restore a soft-deleted question.
 * Reverses the delete: sets is_deleted = 0, increments exam duration/marks.
 */

$data = json_decode(file_get_contents("php://input"), true);

if (empty($data['id'])) {
    echo json_encode(['success' => false, 'message' => 'Question ID is required.']);
    exit;
}

$id = intval($data['id']);

// Fetch question info
$stmt_fetch = $conn->prepare("SELECT question, exam_id, is_deleted FROM questions WHERE id = ?");
$stmt_fetch->bind_param("i", $id);
$stmt_fetch->execute();
$result = $stmt_fetch->get_result();
if ($result->num_rows === 0) {
    echo json_encode(['success' => false, 'message' => 'Question not found.']);
    exit;
}
$row = $result->fetch_assoc();
$question_text = $row['question'];
$exam_id = $row['exam_id'];
$is_deleted = $row['is_deleted'];
$stmt_fetch->close();

if (!$is_deleted) {
    echo json_encode(['success' => true, 'message' => 'Question is already active.']);
    exit;
}

$conn->begin_transaction();

try {
    // Restore the question
    $stmt = $conn->prepare("UPDATE questions SET is_deleted = 0 WHERE id = ?");
    $stmt->bind_param("i", $id);

    if ($stmt->execute() && $stmt->affected_rows > 0) {
        // Update exam duration and marks (reverse of delete)
        $update_exam = $conn->prepare("UPDATE exams SET duration = duration + 1, total_marks = total_marks + 1 WHERE id = ?");
        $update_exam->bind_param("i", $exam_id);
        $update_exam->execute();
        $update_exam->close();

        // Log activity
        $msg = "Question ID $id restored to Exam ID $exam_id. Text: '" . substr($question_text, 0, 50) . (strlen($question_text) > 50 ? "..." : "") . "'";
        $stmt_log = $conn->prepare("INSERT INTO activity_log (activity_type, activity_message) VALUES (?, ?)");
        $type = 'Question Restored';
        $stmt_log->bind_param("ss", $type, $msg);
        $stmt_log->execute();
        $stmt_log->close();

        $conn->commit();
        echo json_encode(['success' => true, 'message' => 'Question restored and exam stats updated.']);
    } else {
        throw new Exception("Failed to restore question.");
    }
} catch (Exception $e) {
    $conn->rollback();
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}

$conn->close();
?>
