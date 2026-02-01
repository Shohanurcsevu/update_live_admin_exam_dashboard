<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *'); // Consider restricting this in production for security
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
require_once 'subject/db_connect.php'; 

// This query now also fetches performance history for each exam.
$sql = "
    SELECT 
        e.id, 
        e.exam_title, 
        e.duration, 
        e.total_marks,
        s.subject_name, 
        l.lesson_name, 
        t.topic_name,
        (SELECT COUNT(*) FROM questions WHERE exam_id = e.id) as total_questions,
        (SELECT GROUP_CONCAT(CONCAT(p.attempt_number, ':', p.score_with_negative) ORDER BY p.attempt_number) 
         FROM performance p WHERE p.exam_id = e.id) as performance_history
    FROM exams e
    LEFT JOIN subjects s ON e.subject_id = s.id
    LEFT JOIN lessons l ON e.lesson_id = l.id
    LEFT JOIN topics t ON e.topic_id = t.id
";

$params = [];
$types = '';
$where_clauses = [];

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

$sql .= " GROUP BY e.id ORDER BY e.id DESC";

$stmt = $conn->prepare($sql);

if (!empty($params)) {
    $stmt->bind_param($types, ...$params);
}

$stmt->execute();
$result = $stmt->get_result();
$exams = [];
while ($row = $result->fetch_assoc()) {
    $history = [];
    if (!empty($row['performance_history'])) {
        $pairs = explode(',', $row['performance_history']);
        foreach ($pairs as $pair) {
            list($attempt, $score) = explode(':', $pair);
            $history[] = ['attempt' => (int)$attempt, 'score' => (float)$score];
        }
    }
    $row['performance_history'] = $history;
    $exams[] = $row;
}

echo json_encode(['success' => true, 'data' => $exams]);
$stmt->close();
$conn->close();
?>
