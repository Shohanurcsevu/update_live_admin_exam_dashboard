<?php
// FILE: api/performance/list-attempts.php
require_once '../subject/db_connect.php';

$sql = "SELECT p.id, p.attempt_time, p.score_with_negative, e.exam_title, e.total_marks
        FROM performance p
        JOIN exams e ON p.exam_id = e.id";

$params = [];
$types = '';
$where_clauses = [];

if (!empty($_GET['subject_id'])) {
    $where_clauses[] = "p.subject_id = ?";
    $params[] = intval($_GET['subject_id']);
    $types .= 'i';
}
if (!empty($_GET['lesson_id'])) {
    $where_clauses[] = "p.lesson_id = ?";
    $params[] = intval($_GET['lesson_id']);
    $types .= 'i';
}
if (!empty($_GET['topic_id'])) {
    $where_clauses[] = "p.topic_id = ?";
    $params[] = intval($_GET['topic_id']);
    $types .= 'i';
}

if (!empty($where_clauses)) {
    $sql .= " WHERE " . implode(' AND ', $where_clauses);
}

$sql .= " ORDER BY p.attempt_time DESC";

$stmt = $conn->prepare($sql);
if (!empty($params)) {
    $stmt->bind_param($types, ...$params);
}
$stmt->execute();
$result = $stmt->get_result();
$attempts = [];
while ($row = $result->fetch_assoc()) {
    $attempts[] = $row;
}

echo json_encode(['success' => true, 'data' => $attempts]);
$stmt->close();
$conn->close();
?>