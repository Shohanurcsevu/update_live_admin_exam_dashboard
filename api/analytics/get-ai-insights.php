<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
require_once '../subject/db_connect.php';

date_default_timezone_set('Asia/Dhaka');

try {
    // 1. Identify Peak Focus Window (Last 7 days)
    // We group activity by hour to find when the user is most active
    $peak_sql = "
        SELECT 
            HOUR(timestamp) as hour, 
            COUNT(*) as activity_count
        FROM activity_log 
        WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        AND (activity_type LIKE '%Exam%' OR activity_type LIKE '%pomodoro%' OR activity_type LIKE '%Subject%')
        GROUP BY HOUR(timestamp)
        ORDER BY activity_count DESC
        LIMIT 1";
    
    $peak_result = $conn->query($peak_sql);
    $peak_hour = 10; // Default fallback
    if ($peak_result && $row = $peak_result->fetch_assoc()) {
        $peak_hour = (int)$row['hour'];
    }

    // Format peak window (e.g., 10 AM - 1 PM)
    $start_time = date("g A", strtotime("$peak_hour:00:00"));
    $end_time = date("g A", strtotime(($peak_hour + 3) . ":00:00"));
    $peak_window = "$start_time - $end_time";

    // 2. Identify Weakest Subject (Lowest Mastery)
    // Reusing logic from mastery-trends to find where they need most help
    $weak_sql = "
        SELECT 
            s.subject_name,
            AVG((p.score_with_negative / e.total_marks) * 100) as avg_accuracy
        FROM subjects s
        JOIN exams e ON s.id = e.subject_id
        JOIN performance p ON e.id = p.exam_id
        WHERE s.is_deleted = 0
        GROUP BY s.id, s.subject_name
        ORDER BY avg_accuracy ASC
        LIMIT 1";

    $weak_result = $conn->query($weak_sql);
    $toughest_subject = "General Knowledge"; // Default fallback
    if ($weak_result && $row = $weak_result->fetch_assoc()) {
        $toughest_subject = $row['subject_name'];
    }

    echo json_encode([
        'success' => true,
        'data' => [
            'peak_window' => $peak_window,
            'peak_hour' => $peak_hour,
            'toughest_subject' => $toughest_subject,
            'recommendation' => "Your peak focus is typically $peak_window. I recommend tackling $toughest_subject during this window for maximum efficiency."
        ]
    ]);

} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}

$conn->close();
?>
