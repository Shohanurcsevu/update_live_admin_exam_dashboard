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
            SUM(CASE WHEN qa.is_correct = 0 AND qa.selected_answer IS NOT NULL THEN 1 ELSE 0 END) as wrong_count,
            SUM(CASE WHEN qa.selected_answer IS NULL AND qa.id IS NOT NULL THEN 1 ELSE 0 END) as unattempted_count,
            MAX(q.id) as ref_id
        FROM questions q
        LEFT JOIN question_attempts qa ON q.id = qa.question_id
        WHERE $where_clause
        GROUP BY q.question";

$sort = isset($_GET['sort']) ? $_GET['sort'] : 'default';
$order_by = "total_attempts DESC, priority DESC";

switch ($sort) {
    case 'attempted':
        $order_by = "total_attempts DESC, priority DESC";
        break;
    case 'unattempted':
        $order_by = "unattempted_count DESC, priority DESC";
        break;
    case 'correct':
        $order_by = "correct_count DESC, priority DESC";
        break;
    case 'wrong':
        $order_by = "wrong_count DESC, priority DESC";
        break;
}

$sql .= " ORDER BY $order_by";

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
// Clone params for summary query (without limit/offset)
$params_for_summary = $params;
$types_for_summary = $types;

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

// Calculate global summary (across all questions matching filters)
$summary_sql = "SELECT 
                    COUNT(DISTINCT question) as total_questions,
                    SUM(correct_count) as total_correct,
                    SUM(wrong_count) as total_wrong,
                    SUM(total_attempts) as total_attempts
                FROM (
                    SELECT 
                        q.question,
                        SUM(CASE WHEN qa.is_correct = 1 THEN 1 ELSE 0 END) as correct_count,
                        SUM(CASE WHEN qa.is_correct = 0 AND qa.selected_answer IS NOT NULL THEN 1 ELSE 0 END) as wrong_count,
                        COUNT(qa.id) as total_attempts
                    FROM questions q
                    LEFT JOIN question_attempts qa ON q.id = qa.question_id
                    WHERE $where_clause
                    GROUP BY q.question
                ) as filtered_aggregation";

$summary_stmt = $conn->prepare($summary_sql);
if (!empty($params_for_summary)) {
    $summary_stmt->bind_param($types_for_summary, ...$params_for_summary);
}
$summary_stmt->execute();
$summary_res = $summary_stmt->get_result()->fetch_assoc();
$summary_stmt->close();

$summary = [
    'total_questions' => intval($summary_res['total_questions']),
    'total_attempts' => intval($summary_res['total_attempts']),
    'total_correct' => intval($summary_res['total_correct']),
    'total_wrong' => intval($summary_res['total_wrong']),
];

$summary['accuracy'] = $summary['total_attempts'] > 0 ? round(($summary['total_correct'] / $summary['total_attempts']) * 100, 2) : 0;

foreach ($questions as &$q) {
    $q['total_attempts'] = intval($q['total_attempts']);
    $q['correct_count'] = intval($q['correct_count']);
    $q['wrong_count'] = intval($q['wrong_count']);
    $q['unattempted_count'] = intval($q['unattempted_count']);
    $q['priority'] = intval($q['priority']);
    $q['accuracy'] = $q['total_attempts'] > 0 ? round(($q['correct_count'] / $q['total_attempts']) * 100, 2) : 0;
}

echo json_encode([
    'success' => true,
    'summary' => $summary,
    'questions' => $questions,
    'total_count' => $total_count
]);

$conn->close();
?>
