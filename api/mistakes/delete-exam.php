<?php
/**
 * Delete Exam Mistakes API
 * 
 * Removes all unresolved mistakes for a specific exam from the Mistake Bank.
 */

require_once '../subject/db_connect.php';
header('Content-Type: application/json');

$data = json_decode(file_get_contents("php://input"), true);

if (!isset($data['exam_id'])) {
    echo json_encode(['success' => false, 'message' => 'No exam ID provided.']);
    exit;
}

$exam_id = intval($data['exam_id']);

// Delete unresolved mistakes for this exam
// Using COALESCE to handle both literal 0 and NULL values for virtual exams
$stmt = $conn->prepare("DELETE FROM mistake_bank WHERE COALESCE(exam_id, 0) = ? AND resolved = 0");
$stmt->bind_param("i", $exam_id);

if ($stmt->execute()) {
    $affected = $stmt->affected_rows;
    echo json_encode([
        'success' => true,
        'message' => "Successfully removed $affected mistakes from the bank.",
        'affected_rows' => $affected
    ]);
} else {
    echo json_encode([
        'success' => false,
        'message' => 'Database error: ' . $conn->error
    ]);
}

$stmt->close();
$conn->close();
?>
