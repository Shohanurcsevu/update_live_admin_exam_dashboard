<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

require_once '../subject/db_connect.php';

// Identify peak performance hours

$days = isset($_GET['days']) ? intval($_GET['days']) : 30;

try {
    $sql = "
        SELECT 
            HOUR(p.attempt_time) as hour,
            AVG((p.score_with_negative / e.total_marks) * 100) as avg_accuracy,
            COUNT(*) as exam_count
        FROM performance p
        JOIN exams e ON p.exam_id = e.id
        WHERE p.attempt_time >= DATE_SUB(CURRENT_DATE, INTERVAL ? DAY)
        GROUP BY HOUR(p.attempt_time)
        HAVING exam_count >= 3
        ORDER BY avg_accuracy DESC
    ";
    
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("i", $days);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $all_hours = [];
    while ($row = $result->fetch_assoc()) {
        $hour = intval($row['hour']);
        
        // Format to 12-hour AM/PM
        $start_time = date("g A", strtotime("$hour:00"));
        $end_time = date("g A", strtotime(($hour + 1) . ":00"));
        $label = "$start_time - $end_time";
        
        $all_hours[] = [
            'hour' => $hour,
            'accuracy' => round(floatval($row['avg_accuracy']), 1),
            'exam_count' => intval($row['exam_count']),
            'label' => $label
        ];
    }
    
    // Get top 2 best and worst hours
    $peak_hours = array_slice($all_hours, 0, 2);
    $worst_hours = array_slice(array_reverse($all_hours), 0, 2);
    
    echo json_encode([
        'success' => true,
        'peak_hours' => $peak_hours,
        'worst_hours' => $worst_hours,
        'all_hours' => $all_hours,
        'period_days' => $days
    ]);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => 'Failed to fetch peak performance: ' . $e->getMessage()
    ]);
}

$conn->close();
?>
