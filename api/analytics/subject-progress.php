<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

require_once '../subject/db_connect.php';

// Get weekly accuracy trends per subject for progress chart

$days = isset($_GET['days']) ? intval($_GET['days']) : 30;

try {
    $sql = "
        SELECT 
            s.subject_name,
            WEEK(p.attempt_time, 1) as week_number,
            DATE(DATE_SUB(p.attempt_time, INTERVAL WEEKDAY(p.attempt_time) DAY)) as week_start,
            AVG((p.score_with_negative / e.total_marks) * 100) as avg_accuracy,
            COUNT(*) as exam_count
        FROM performance p
        JOIN exams e ON p.exam_id = e.id
        JOIN subjects s ON e.subject_id = s.id
        WHERE p.attempt_time >= DATE_SUB(CURRENT_DATE, INTERVAL ? DAY)
        GROUP BY s.id, s.subject_name, WEEK(p.attempt_time, 1), week_start
        ORDER BY s.subject_name, week_start ASC
    ";
    
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("i", $days);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $subjects = [];
    while ($row = $result->fetch_assoc()) {
        $subject = $row['subject_name'];
        if (!isset($subjects[$subject])) {
            $subjects[$subject] = [];
        }
        $subjects[$subject][] = [
            'week_start' => $row['week_start'],
            'accuracy' => round(floatval($row['avg_accuracy']), 1),
            'exam_count' => intval($row['exam_count'])
        ];
    }
    
    echo json_encode([
        'success' => true,
        'subjects' => $subjects,
        'period_days' => $days
    ]);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => 'Failed to fetch subject progress: ' . $e->getMessage()
    ]);
}

$conn->close();
?>
