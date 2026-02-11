<?php
header('Content-Type: application/json');
require_once '../subject/db_connect.php';

date_default_timezone_set('Asia/Dhaka');

$subject_id = $_GET['subject_id'] ?? null;
$range = $_GET['range'] ?? 'today';

if (!$subject_id) {
    echo json_encode(['success' => false, 'error' => 'Subject ID is required']);
    exit;
}

try {
    // Determine date range condition
    $dateCondition = "DATE(p.attempt_time) = CURRENT_DATE";
    if ($range === 'week') {
        $dateCondition = "p.attempt_time >= DATE_SUB(NOW(), INTERVAL 7 DAY)";
    } elseif ($range === 'month') {
        $dateCondition = "p.attempt_time >= DATE_SUB(NOW(), INTERVAL 30 DAY)";
    } elseif ($range === 'last_month') {
        $dateCondition = "p.attempt_time >= DATE_SUB(NOW(), INTERVAL 60 DAY) AND p.attempt_time < DATE_SUB(NOW(), INTERVAL 30 DAY)";
    } elseif ($range === 'year') {
        $dateCondition = "p.attempt_time >= DATE_SUB(NOW(), INTERVAL 365 DAY)";
    }

    // Fetch Exams
    $sql = "
        SELECT 
            e.exam_title as title,
            p.time_used_seconds,
            p.score,
            p.attempt_time as timestamp,
            (SELECT COUNT(*) FROM questions q WHERE q.exam_id = e.id AND q.is_deleted = 0) as total_questions
        FROM performance p
        JOIN exams e ON p.exam_id = e.id
        WHERE e.subject_id = ? 
        AND $dateCondition
        AND e.is_deleted = 0
        ORDER BY p.attempt_time DESC
    ";

    $stmt = $conn->prepare($sql);
    $stmt->bind_param("i", $subject_id);
    $stmt->execute();
    $result = $stmt->get_result();

    $activities = [];
    while ($row = $result->fetch_assoc()) {
        $activities[] = [
            'type' => 'exam',
            'title' => $row['title'],
            'seconds' => $row['time_used_seconds'] > 0 ? ceil($row['time_used_seconds'] / 60) * 60 : 0, // Apply rounding logic
            'score' => $row['score'],
            'total_questions' => $row['total_questions'],
            'timestamp' => $row['timestamp'],
            'formatted_time' => date('h:i A', strtotime($row['timestamp']))
        ];
    }
    
    // Potentially add Pomodoro sessions here if needed, but start with exams as requested.

    echo json_encode(['success' => true, 'data' => $activities]);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}

$conn->close();
?>
