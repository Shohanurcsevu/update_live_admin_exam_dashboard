<?php
/**
 * Mastery Quiz Questions API
 * 
 * Fetches 15 questions from the Mistake Bank.
 */

require_once '../subject/db_connect.php';
header('Content-Type: application/json');

$limit = isset($_GET['limit']) ? intval($_GET['limit']) : 15;
$exam_id = isset($_GET['exam_id']) ? intval($_GET['exam_id']) : null;

// Fetch mistake question IDs that are not resolved, prioritizing those missed multiple times
$sql = "SELECT mb.question_id, mb.subject_id, mb.lesson_id, mb.topic_id, mb.is_custom, q.* 
        FROM mistake_bank mb 
        JOIN questions q ON mb.question_id = q.id 
        WHERE mb.resolved = 0 ";

if ($exam_id !== null) {
    $sql .= " AND mb.exam_id = ? ";
} else {
    $sql .= " AND mb.exam_id IS NULL "; // Or remove this if you want global mastery fallback
}

$sql .= " ORDER BY mb.mistake_count DESC, RAND() LIMIT ?";

$stmt = $conn->prepare($sql);

if ($exam_id !== null) {
    $stmt->bind_param("ii", $exam_id, $limit);
} else {
    $stmt->bind_param("i", $limit);
}

$stmt->execute();
$result = $stmt->get_result();

$questions = [];
while ($row = $result->fetch_assoc()) {
    if (isset($row['options']) && is_string($row['options'])) {
        $row['options'] = json_decode($row['options'], true);
    }
    $questions[] = $row;
}

echo json_encode([
    'success' => true,
    'data' => $questions
]);

$stmt->close();
$conn->close();
?>
