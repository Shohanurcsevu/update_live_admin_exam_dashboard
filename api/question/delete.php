<?php
require_once '../subject/db_connect.php';

$data = json_decode(file_get_contents("php://input"), true);

if (empty($data['id'])) {
    echo json_encode(['success' => false, 'message' => 'Question ID is required.']);
    exit;
}

$id = intval($data['id']);

// Fetch question info and exam_id before deleting
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
$was_deleted = $row['is_deleted'];
$stmt_fetch->close();

if ($was_deleted) {
    echo json_encode(['success' => true, 'message' => 'Question already deleted.']);
    exit;
}

$conn->begin_transaction();

try {
    $stmt = $conn->prepare("UPDATE questions SET is_deleted = 1 WHERE id = ?");
    $stmt->bind_param("i", $id);

    if ($stmt->execute()) {
        if ($stmt->affected_rows > 0) {
            // Update Exam duration and marks
            $update_exam = $conn->prepare("UPDATE exams SET duration = GREATEST(0, duration - 1), total_marks = GREATEST(0, total_marks - 1) WHERE id = ?");
            $update_exam->bind_param("i", $exam_id);
            $update_exam->execute();
            $update_exam->close();

            // Log activity
            $msg = "Question ID $id deleted from Exam ID $exam_id. Text: '" . substr($question_text, 0, 50) . (strlen($question_text) > 50 ? "..." : "") . "'";
            $stmt_log = $conn->prepare("INSERT INTO activity_log (activity_type, activity_message) VALUES (?, ?)");
            $type = 'Question Deleted';
            $stmt_log->bind_param("ss", $type, $msg);
            $stmt_log->execute();
            $stmt_log->close();

            $conn->commit();
            echo json_encode(['success' => true, 'message' => 'Question deleted and exam stats updated.']);
        } else {
            throw new Exception("No question was updated.");
        }
    } else {
        throw new Exception("Failed to execute question delete statement.");
    }
} catch (Exception $e) {
    $conn->rollback();
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}

$conn->close();
?>
