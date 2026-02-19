<?php
require_once '../subject/db_connect.php';
header('Content-Type: application/json');

$subject_id = isset($_GET['subject_id']) ? intval($_GET['subject_id']) : null;
$lesson_id = isset($_GET['lesson_id']) ? intval($_GET['lesson_id']) : null;
$topic_id = isset($_GET['topic_id']) ? intval($_GET['topic_id']) : null;

$where = ["q.is_deleted = 0"];
$params = [];
$types = "";

if ($subject_id) {
    $where[] = "q.subject_id = ?";
    $params[] = $subject_id;
    $types .= "i";
}
if ($lesson_id) {
    $where[] = "q.lesson_id = ?";
    $params[] = $lesson_id;
    $types .= "i";
}
if ($topic_id) {
    $where[] = "q.topic_id = ?";
    $params[] = $topic_id;
    $types .= "i";
}

$where_clause = implode(" AND ", $where);

// Group by question text to handle duplicates correctly across different exams
// We use MAX(q.id) to get a reference question ID for later exam generation
$sql = "SELECT 
            q.question,
            MAX(q.priority) as priority,
            COUNT(qa.id) as total_attempts,
            SUM(CASE WHEN qa.is_correct = 1 THEN 1 ELSE 0 END) as correct_count,
            SUM(CASE WHEN qa.is_correct = 0 THEN 1 ELSE 0 END) as wrong_count,
            SUM(CASE WHEN qa.selected_answer IS NULL AND qa.id IS NOT NULL THEN 1 ELSE 0 END) as unattempted_count,
            MAX(q.id) as ref_id
        FROM questions q
        LEFT JOIN question_attempts qa ON q.id = qa.question_id
        WHERE $where_clause
        GROUP BY q.question
        ORDER BY total_attempts DESC, priority DESC";

// Pagination
$limit = isset($_GET['limit']) ? intval($_GET['limit']) : 10;
$offset = isset($_GET['offset']) ? intval($_GET['offset']) : 0;

// Total Count
$count_sql = "SELECT COUNT(DISTINCT q.question) as total FROM questions q WHERE $where_clause";
$count_stmt = $conn->prepare($count_sql);
if (!empty($params)) {
    $count_stmt->bind_param($types, ...$params);
}
$count_stmt->execute();
$total_count = $count_stmt->get_result()->fetch_assoc()['total'];
$count_stmt->close();

$sql .= " LIMIT ? OFFSET ?";
$params[] = $limit;
$params[] = $offset;
$types .= "ii";

$stmt = $conn->prepare($sql);
if (!empty($params)) {
    $stmt->bind_param($types, ...$params);
}
$stmt->execute();
$result = $stmt->get_result();
$questions = $result->fetch_all(MYSQLI_ASSOC);

// Calculate summary
$summary = [
    'total_questions' => count($questions),
    'total_attempts' => 0,
    'total_correct' => 0,
    'total_wrong' => 0,
    'total_unattempted' => 0
];

foreach ($questions as &$q) {
    $q['total_attempts'] = intval($q['total_attempts']);
    $q['correct_count'] = intval($q['correct_count']);
    $q['wrong_count'] = intval($q['wrong_count']);
    $q['unattempted_count'] = intval($q['unattempted_count']);
    $q['priority'] = intval($q['priority']);
    
    $q['accuracy'] = $q['total_attempts'] > 0 ? round(($q['correct_count'] / $q['total_attempts']) * 100, 2) : 0;
    
    $summary['total_attempts'] += $q['total_attempts'];
    $summary['total_correct'] += $q['correct_count'];
    $summary['total_wrong'] += $q['wrong_count'];
    $summary['total_unattempted'] += $q['unattempted_count'];
}

$summary['accuracy'] = $summary['total_attempts'] > 0 ? round(($summary['total_correct'] / $summary['total_attempts']) * 100, 2) : 0;

echo json_encode([
    'success' => true,
    'summary' => $summary,
    'questions' => $questions,
    'total_count' => $total_count
]);

$conn->close();
?>
