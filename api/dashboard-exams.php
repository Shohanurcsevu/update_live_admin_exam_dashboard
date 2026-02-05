<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *'); // Consider restricting this in production for security
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
require_once 'subject/db_connect.php'; 

// This query now also fetches performance history for each exam.
$limit = isset($_GET['limit']) ? intval($_GET['limit']) : 10;
$offset = isset($_GET['offset']) ? intval($_GET['offset']) : 0;

$where_clauses = [];
$params = [];
$types = '';

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

$where_sql = !empty($where_clauses) ? " WHERE " . implode(' AND ', $where_clauses) : "";

$sql = "
    SELECT 
        e.id, 
        e.exam_title, 
        e.duration, 
        e.total_marks,
        e.subject_id,
        e.lesson_id,
        e.topic_id,
        s.subject_name, 
        l.lesson_name, 
        t.topic_name,
        q_count.total_questions,
        p_history.performance_history
    FROM exams e
    LEFT JOIN subjects s ON e.subject_id = s.id
    LEFT JOIN lessons l ON e.lesson_id = l.id
    LEFT JOIN topics t ON e.topic_id = t.id
    LEFT JOIN (
        SELECT exam_id, COUNT(*) as total_questions 
        FROM questions 
        GROUP BY exam_id
    ) q_count ON e.id = q_count.exam_id
    LEFT JOIN (
        SELECT exam_id, GROUP_CONCAT(CONCAT(attempt_number, ':', score_with_negative) ORDER BY attempt_number) as performance_history
        FROM performance 
        GROUP BY exam_id
    ) p_history ON e.id = p_history.exam_id
    $where_sql
    ORDER BY e.id DESC
    LIMIT ? OFFSET ?
";

$params[] = $limit;
$params[] = $offset;
$types .= 'ii';

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
        $perf_strings = explode(',', $row['performance_history']);
        foreach ($perf_strings as $pair) {
            if (strpos($pair, ':') !== false) {
                list($attempt, $score) = explode(':', $pair);
                $history[] = ['attempt' => (int)$attempt, 'score' => (float)$score];
            }
        }
    }
    $row['performance_history'] = $history;
    $exams[] = $row;
}

// Get total count for pagination info
$count_sql = "SELECT COUNT(*) as total FROM exams e $where_sql";
$count_stmt = $conn->prepare($count_sql);
if (!empty($where_clauses)) {
    $count_types = substr($types, 0, -2); // Remove 'ii' from types
    $count_params = array_slice($params, 0, -2);
    $count_stmt->bind_param($count_types, ...$count_params);
}
$count_stmt->execute();
$total_count = $count_stmt->get_result()->fetch_assoc()['total'];

echo json_encode([
    'success' => true, 
    'data' => $exams,
    'pagination' => [
        'total' => (int)$total_count,
        'limit' => $limit,
        'offset' => $offset,
        'hasMore' => ($offset + $limit) < $total_count
    ]
]);
$stmt->close();
$count_stmt->close();
$conn->close();
?>
