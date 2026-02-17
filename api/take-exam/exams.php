<?php
require_once '../subject/db_connect.php';

// --- MODIFIED: Changed all INNER JOINs to LEFT JOINs ---
// This ensures that all exams are fetched, even if their subject, lesson, or topic IDs are NULL.
$sql = "SELECT 
            e.id, 
            e.exam_title, 
            e.duration, 
            e.total_marks,
            s.subject_name, 
            l.lesson_name, 
            t.topic_name,
            (SELECT COUNT(*) FROM questions WHERE exam_id = e.id AND is_deleted = 0) as total_questions,
            p.last_score,
            (p.last_score / NULLIF(e.total_marks, 0)) * 100 as last_percentage,
            p.total_attempts as attempt_count
        FROM exams e
        LEFT JOIN subjects s ON e.subject_id = s.id
        LEFT JOIN lessons l ON e.lesson_id = l.id
        LEFT JOIN topics t ON e.topic_id = t.id
        LEFT JOIN (
            SELECT 
                exam_id, 
                score_with_negative as last_score,
                COUNT(*) as total_attempts
            FROM performance
            WHERE (exam_id, attempt_number) IN (
                SELECT exam_id, MAX(attempt_number)
                FROM performance
                GROUP BY exam_id
            )
            GROUP BY exam_id
        ) p ON e.id = p.exam_id";

$params = [];
$types = '';
$where_clauses = ["e.is_deleted = 0", "e.is_revision = 0"];

// The UI filter logic remains the same and will work as expected.
// If a filter is applied, it will correctly narrow down the results.
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

// --- Pagination Logic ---
$limit = isset($_GET['limit']) ? intval($_GET['limit']) : 20;
$page = isset($_GET['page']) ? intval($_GET['page']) : 1;
$offset = ($page - 1) * $limit;

if (!empty($where_clauses)) {
    $where_sql = " WHERE " . implode(' AND ', $where_clauses);
    $sql .= $where_sql;
}

// Get Total Count for Pagination
$count_sql = "SELECT COUNT(*) as total FROM exams e " . (isset($where_sql) ? $where_sql : "");
$count_stmt = $conn->prepare($count_sql);
if (!empty($params)) {
    $count_stmt->bind_param($types, ...$params);
}
$count_stmt->execute();
$total_count = $count_stmt->get_result()->fetch_assoc()['total'];
$count_stmt->close();

$sql .= " ORDER BY e.id DESC LIMIT ? OFFSET ?";
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
    $exams[] = $row;
}

echo json_encode([
    'success' => true, 
    'data' => $exams,
    'pagination' => [
        'total' => $total_count,
        'limit' => $limit,
        'page' => $page,
        'has_more' => ($offset + count($exams)) < $total_count
    ]
]);
$stmt->close();
$conn->close();
?>
