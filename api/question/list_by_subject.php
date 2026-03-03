<?php
require_once '../subject/db_connect.php';

/**
 * Cross-Exam Question Retrieval
 * Returns questions from all exams sharing the same subject as the given exam,
 * excluding the current exam itself.
 * Usage: ?exam_id=805
 */

if (empty($_GET['exam_id'])) {
    echo json_encode(['success' => false, 'message' => 'exam_id is required.']);
    exit;
}

$exam_id = intval($_GET['exam_id']);

// 1. Get the subject_id of the current exam
$stmt = $conn->prepare("SELECT subject_id FROM exams WHERE id = ?");
$stmt->bind_param("i", $exam_id);
$stmt->execute();
$exam_result = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$exam_result) {
    echo json_encode(['success' => false, 'message' => 'Exam not found.']);
    exit;
}

$subject_id = intval($exam_result['subject_id']);

// 2. Get all questions from other exams in the same subject
$stmt2 = $conn->prepare("
    SELECT q.*, e.exam_title 
    FROM questions q
    JOIN exams e ON q.exam_id = e.id
    WHERE q.exam_id != ? 
      AND e.subject_id = ?
      AND q.is_deleted = 0
    ORDER BY q.exam_id ASC, q.id ASC
    LIMIT 2000
");
$stmt2->bind_param("ii", $exam_id, $subject_id);
$stmt2->execute();
$result = $stmt2->get_result();

$questions = [];
while ($row = $result->fetch_assoc()) {
    $row['options'] = json_decode($row['options']);
    $questions[] = $row;
}

echo json_encode([
    'success' => true, 
    'data' => $questions,
    'subject_id' => $subject_id,
    'count' => count($questions)
]);
$stmt2->close();
$conn->close();
?>
