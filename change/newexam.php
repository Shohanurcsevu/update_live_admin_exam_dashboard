<?php
require_once '../subject/db_connect.php';

// --- MODIFIED: Changed all LEFT JOINs to INNER JOINs ---
// This ensures that only exams with a valid, non-null subject, lesson, AND topic are fetched.
$sql = "SELECT 
            e.id, 
            e.exam_title, 
            e.duration, 
            s.subject_name, 
            l.lesson_name, 
            t.topic_name,
            (SELECT COUNT(*) FROM questions WHERE exam_id = e.id) as total_questions
        FROM exams e
        INNER JOIN subjects s ON e.subject_id = s.id
        INNER JOIN lessons l ON e.lesson_id = l.id
        INNER JOIN topics t ON e.topic_id = t.id";

$params = [];
$types = '';
$where_clauses = [];

// The UI filter logic remains the same
if (!empty($_GET['subject_id'])) {
    $where_clauses[] = "e.subject_id = ?";
    $params[] = intval($_GET['subject_id']);
    $types .= 'i';
}
if (!empty($_GET['lesson_id'])) {
    $where_clauses[] = "e.lesson_id = ?";
    $params[] = intval($_GET['lesson_id']);
    $types .= 'i';
}
if (!empty($_GET['topic_id'])) {
    $where_clauses[] = "e.topic_id = ?";
    $params[] = intval($_GET['topic_id']);
    $types .= 'i';
}

if (!empty($where_clauses)) {
    $sql .= " WHERE " . implode(' AND ', $where_clauses);
}

$sql .= " ORDER BY e.id ASC";

$stmt = $conn->prepare($sql);
if (!empty($params)) {
    $stmt->bind_param($types, ...$params);
}
$stmt->execute();
$result = $stmt->get_result();
$exams = [];
while ($row = $result->fetch_assoc()) {
    $exams[] = $row;
}

echo json_encode(['success' => true, 'data' => $exams]);
$stmt->close();
$conn->close();
?>
