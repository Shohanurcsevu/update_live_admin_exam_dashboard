<?php
require_once '../subject/db_connect.php';

header('Content-Type: application/json');

$conn->set_charset("utf8mb4");

if (empty($_GET['q'])) {
    echo json_encode(['success' => true, 'data' => []]);
    exit;
}

$query = $_GET['q'];
$searchTerm = "%{$query}%";

// Search in question, explanation (LEFT JOIN for resilience)
$stmt = $conn->prepare("
    SELECT q.*, e.exam_title, s.subject_name 
    FROM questions q
    LEFT JOIN exams e ON q.exam_id = e.id
    LEFT JOIN subjects s ON e.subject_id = s.id
    WHERE (q.question LIKE ? OR q.explanation LIKE ?) 
    AND q.is_deleted = 0
    ORDER BY q.id DESC
    LIMIT 30
");

$stmt->bind_param("ss", $searchTerm, $searchTerm);
$stmt->execute();
$result = $stmt->get_result();

$matches = [];
while ($row = $result->fetch_assoc()) {
    $matches[] = [
        'id' => $row['id'],
        'text' => strip_tags($row['question']), // Remove HTML for cleaner result
        'subtext' => "Exam: " . ($row['exam_title'] ?? 'General') . " (" . ($row['subject_name'] ?? 'N/A') . ")",
        'type' => 'question',
        'exam_id' => $row['exam_id']
    ];
}

echo json_encode(['success' => true, 'data' => $matches, 'query' => $query]);

$stmt->close();
$conn->close();
?>
