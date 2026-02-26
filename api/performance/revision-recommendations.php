<?php
require_once '../subject/db_connect.php';
header('Content-Type: application/json');

/*
REVISION RECOMMENDATION LOGIC
Ranking topics based on:
1. Accuracy (Wrong questions)
2. Coverage (Unattempted questions)
3. Recency (Days since last_revised_at)
4. Urgency (Days until subject end_date)
*/

$subject_id = isset($_GET['subject_id']) ? intval($_GET['subject_id']) : null;
$lesson_id = isset($_GET['lesson_id']) ? intval($_GET['lesson_id']) : null;
$topic_id = isset($_GET['topic_id']) ? intval($_GET['topic_id']) : null;
$exam_id = isset($_GET['exam_id']) ? intval($_GET['exam_id']) : null;
$scope = isset($_GET['scope']) ? $_GET['scope'] : 'topic'; // topic, exam
$weak_only = isset($_GET['weak_only']) && $_GET['weak_only'] === 'true';
$period = isset($_GET['period']) ? $_GET['period'] : 'all'; // all, today, yesterday, last_2_days, ..., last_7_days, week, month, year
$limit = isset($_GET['limit']) ? intval($_GET['limit']) : 10;
$offset = isset($_GET['offset']) ? intval($_GET['offset']) : 0;

$where = ["t.is_deleted = 0"];
$params = [];
$types = "";

if ($subject_id) {
    $where[] = "t.subject_id = ?";
    $params[] = $subject_id;
    $types .= "i";
}
if ($lesson_id) {
    $where[] = "t.lesson_id = ?";
    $params[] = $lesson_id;
    $types .= "i";
}
if ($topic_id) {
    $where[] = "t.id = ?";
    $params[] = $topic_id;
    $types .= "i";
}
if ($exam_id) {
    $where[] = "e.id = ?";
    $params[] = $exam_id;
    $types .= "i";
}

if ($period !== 'all') {
    $date_col = ($scope === 'exam') ? "e.created_at" : "t.last_revised_at";
    switch ($period) {
        case 'today':
            $where[] = "DATE($date_col) = CURRENT_DATE";
            break;
        case 'yesterday':
            $where[] = "DATE($date_col) = DATE_SUB(CURRENT_DATE, INTERVAL 1 DAY)";
            break;
        case 'last_2_days':
            $where[] = "$date_col >= DATE_SUB(NOW(), INTERVAL 2 DAY)";
            break;
        case 'last_3_days':
            $where[] = "$date_col >= DATE_SUB(NOW(), INTERVAL 3 DAY)";
            break;
        case 'last_7_days':
            $where[] = "$date_col >= DATE_SUB(NOW(), INTERVAL 7 DAY)";
            break;
        case 'month':
            $where[] = "$date_col >= DATE_SUB(NOW(), INTERVAL 1 MONTH)";
            break;
        case 'year':
            $where[] = "$date_col >= DATE_SUB(NOW(), INTERVAL 1 YEAR)";
            break;
    }
}

$where_clause = implode(" AND ", $where);

if ($scope === 'exam') {
    $sql = "SELECT 
                e.id as exam_id,
                e.exam_title,
                t.id as topic_id,
                t.topic_name,
                s.subject_name,
                l.lesson_name,
                e.created_at as last_revised_at,
                t.updated_at,
                s.start_date,
                s.end_date as exam_date,
                COUNT(DISTINCT q.id) as total_questions,
                SUM(COALESCE(att.is_correct_distinct, 0)) as correct_q_count,
                SUM(COALESCE(att.is_wrong_distinct, 0)) as wrong_q_count,
                SUM(COALESCE(att.correct_attempts, 0)) as correct_count,
                SUM(COALESCE(att.wrong_attempts, 0)) as wrong_count,
                (COUNT(DISTINCT q.id) - COUNT(DISTINCT CASE WHEN att.has_attempts = 1 THEN q.id END)) as unattempted_count,
                SUM(COALESCE(att.total_attempts, 0)) as total_attempts
            FROM exams e
            JOIN topics t ON e.topic_id = t.id
            JOIN subjects s ON t.subject_id = s.id
            JOIN lessons l ON t.lesson_id = l.id
            LEFT JOIN questions q ON e.id = q.exam_id AND q.is_deleted = 0
            LEFT JOIN (
                SELECT 
                    q_sub.question,
                    SUM(CASE WHEN qa.is_correct = 1 THEN 1 ELSE 0 END) as correct_attempts,
                    SUM(CASE WHEN qa.is_correct = 0 THEN 1 ELSE 0 END) as wrong_attempts,
                    COUNT(qa.id) as total_attempts,
                    -- Display metrics: 1 only if the LATEST attempt has this status
                    MAX(CASE WHEN qa.id = latest.max_id AND qa.is_correct = 1 THEN 1 ELSE 0 END) as is_correct_distinct,
                    MAX(CASE WHEN qa.id = latest.max_id AND qa.is_correct = 0 THEN 1 ELSE 0 END) as is_wrong_distinct,
                    1 as has_attempts
                FROM questions q_sub
                JOIN question_attempts qa ON q_sub.id = qa.question_id
                JOIN (
                    -- Find latest attempt per unique question text
                    SELECT q_inn.question, MAX(qa_inn.id) as max_id
                    FROM questions q_inn
                    JOIN question_attempts qa_inn ON q_inn.id = qa_inn.question_id
                    GROUP BY q_inn.question
                ) latest ON q_sub.question = latest.question
                GROUP BY q_sub.question
            ) att ON q.question = att.question
            WHERE $where_clause AND e.is_deleted = 0 AND e.is_revision = 0
            GROUP BY e.id
            HAVING total_questions > 0";
} else {
    $sql = "SELECT 
                t.id as topic_id,
                t.topic_name,
                s.subject_name,
                l.lesson_name,
                t.last_revised_at,
                t.updated_at,
                s.start_date,
                s.end_date as exam_date,
                COUNT(DISTINCT q.id) as total_questions,
                SUM(COALESCE(att.is_correct_distinct, 0)) as correct_q_count,
                SUM(COALESCE(att.is_wrong_distinct, 0)) as wrong_q_count,
                SUM(COALESCE(att.correct_attempts, 0)) as correct_count,
                SUM(COALESCE(att.wrong_attempts, 0)) as wrong_count,
                (COUNT(DISTINCT q.id) - COUNT(DISTINCT CASE WHEN att.has_attempts = 1 THEN q.id END)) as unattempted_count,
                SUM(COALESCE(att.total_attempts, 0)) as total_attempts
            FROM topics t
            JOIN subjects s ON t.subject_id = s.id
            JOIN lessons l ON t.lesson_id = l.id
            LEFT JOIN questions q ON t.id = q.topic_id AND q.is_deleted = 0
            LEFT JOIN (
                SELECT 
                    q_sub.question,
                    SUM(CASE WHEN qa.is_correct = 1 THEN 1 ELSE 0 END) as correct_attempts,
                    SUM(CASE WHEN qa.is_correct = 0 THEN 1 ELSE 0 END) as wrong_attempts,
                    COUNT(qa.id) as total_attempts,
                    -- Display metrics: 1 only if the LATEST attempt has this status
                    MAX(CASE WHEN qa.id = latest.max_id AND qa.is_correct = 1 THEN 1 ELSE 0 END) as is_correct_distinct,
                    MAX(CASE WHEN qa.id = latest.max_id AND qa.is_correct = 0 THEN 1 ELSE 0 END) as is_wrong_distinct,
                    1 as has_attempts
                FROM questions q_sub
                JOIN question_attempts qa ON q_sub.id = qa.question_id
                JOIN (
                    -- Find latest attempt per unique question text
                    SELECT q_inn.question, MAX(qa_inn.id) as max_id
                    FROM questions q_inn
                    JOIN question_attempts qa_inn ON q_inn.id = qa_inn.question_id
                    GROUP BY q_inn.question
                ) latest ON q_sub.question = latest.question
                GROUP BY q_sub.question
            ) att ON q.question = att.question
            WHERE $where_clause
            GROUP BY t.id
            HAVING total_questions > 0";
}

$stmt = $conn->prepare($sql);
if (!empty($params)) {
    $stmt->bind_param($types, ...$params);
}
$stmt->execute();
$result = $stmt->get_result();
$topics = $result->fetch_all(MYSQLI_ASSOC);

$recommendations = [];
$now = new DateTime();

foreach ($topics as $topic) {
    // 1. Accuracy Score (0-100, where 100 means high priority/bad performance)
    $total_q = intval($topic['total_questions']);
    $correct = intval($topic['correct_count']);
    $wrong = intval($topic['wrong_count']);
    $unattempted = intval($topic['unattempted_count']);
    
    $accuracy = $total_q > 0 ? (intval($topic['correct_q_count']) / $total_q) * 100 : 100;
    // But we want to prioritize topics with WRONG answers
    // Keep attempt-based rate for ranking, but distinct-based for display
    $wrong_rate_score = $total_q > 0 ? ($wrong / $total_q) : 0;
    $wrong_rate_display = $total_q > 0 ? (intval($topic['wrong_q_count']) / $total_q) : 0;
    
    // 2. Coverage Score (0-1)
    $unattempted_rate = $total_q > 0 ? ($unattempted / $total_q) : 1;
    
    // 3. Recency Score (0-1)
    $fallback_date = $topic['updated_at'] ?: $topic['start_date'];
    $effective_last_revised = $topic['last_revised_at'] ? new DateTime($topic['last_revised_at']) : new DateTime($fallback_date);
    $days_since_revision = $now->diff($effective_last_revised)->days;
    $recency_weight = min($days_since_revision / 30, 1); // Max weight after 30 days
    
    // 4. Urgency Score (0-1)
    $exam_date = $topic['exam_date'] ? new DateTime($topic['exam_date']) : null;
    $urgency_weight = 0;
    if ($exam_date) {
        $days_until_exam = $now->diff($exam_date)->days;
        if ($now > $exam_date) $urgency_weight = 1; // Overdue
        else $urgency_weight = max(0, 1 - ($days_until_exam / 14)); // Higher weight if within 14 days
    }

    // Final Score Calculation
    // Accuracy (Wrong %) is the most important factor
    // We use the raw wrong_rate (sum of attempts) for score to penalize repeated failures
    $score = ($wrong_rate_score * 50) + ($unattempted_rate * 30) + ($recency_weight * 10) + ($urgency_weight * 10);
    
    // Determine priority label and reason
    $reason = "";
    if ($wrong_rate_display > 0.3) $reason = round($wrong_rate_display * 100) . "% wrong answers";
    elseif ($unattempted_rate > 0.5) $reason = round($unattempted_rate * 100) . "% not attempted";
    elseif ($topic['last_revised_at'] === null) $reason = "Never revised ($days_since_revision days)";
    elseif ($days_since_revision > 14) $reason = "Not revised in $days_since_revision days";
    elseif ($urgency_weight > 0.5) $reason = "Approaching exam date";
    else $reason = "Periodic review";

    $recommendations[] = [
        'topic_id' => $topic['topic_id'],
        'topic_name' => $topic['topic_name'],
        'subject_name' => $topic['subject_name'],
        'lesson_name' => $topic['lesson_name'],
        'exam_id' => $topic['exam_id'] ?? null,
        'exam_title' => $topic['exam_title'] ?? null,
        'accuracy' => round($accuracy, 1),
        'wrong_count' => $wrong,
        'unattempted_count' => $unattempted,
        'last_revised' => $topic['last_revised_at'] ? date('d M Y', strtotime($topic['last_revised_at'])) : 'Never',
        'priority_score' => $score,
        'reason' => $reason
    ];
}

// Filter weak only if requested
if ($weak_only) {
    $recommendations = array_filter($recommendations, function($r) {
        return $r['priority_score'] > 20; // threshold for "weak"
    });
    $recommendations = array_values($recommendations); // Re-index
}

// Sort by priority score DESC
usort($recommendations, function($a, $b) {
    return $b['priority_score'] <=> $a['priority_score'];
});

$total_results = count($recommendations);

// Calculate summary stats for the ENTIRE filtered result set
$weakest = $total_results > 0 ? $recommendations[0] : null;
$overdue_count = 0;
$total_acc = 0;
foreach ($recommendations as $r) {
    if ($r['last_revised'] === 'Never' || strpos($r['reason'], 'days') !== false) {
        $overdue_count++;
    }
    $total_acc += $r['accuracy'];
}
$avg_acc = $total_results > 0 ? $total_acc / $total_results : 0;

$recommendations = array_slice($recommendations, $offset, $limit);

echo json_encode([
    'success' => true,
    'data' => $recommendations,
    'total' => $total_results,
    'has_more' => ($offset + $limit) < $total_results,
    'summary' => [
        'weakest_topic' => $weakest ? $weakest['topic_name'] : 'None',
        'weakest_reason' => $weakest ? $weakest['reason'] : 'No data',
        'overdue_count' => $overdue_count,
        'avg_accuracy' => round($avg_acc, 1) . '%'
    ]
]);

$conn->close();
?>
