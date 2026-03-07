<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
require_once '../subject/db_connect.php';

date_default_timezone_set('Asia/Dhaka');

try {
    // Current time components for filtering yesterday's data
    $current_time = date('H:i:s');
    $yesterday = date('Y-m-d', strtotime('-1 day'));
    $yesterday_start = $yesterday . ' 00:00:00';
    $yesterday_current_cutoff = $yesterday . ' ' . $current_time;

    // 1. Study time from Exams yesterday (up to this time)
    $exam_sql = "
        SELECT SUM(
            CASE 
                WHEN p.time_used_seconds > 0 THEN p.time_used_seconds 
                ELSE (SELECT COUNT(*) FROM questions q WHERE q.exam_id = e.id AND q.is_deleted = 0) * 60 
            END
        ) as seconds
        FROM performance p
        JOIN exams e ON p.exam_id = e.id
        WHERE p.attempt_time BETWEEN '$yesterday_start' AND '$yesterday_current_cutoff'";
    
    $exam_res = $conn->query($exam_sql);
    $exam_seconds = ($exam_res && $row = $exam_res->fetch_assoc()) ? (int)$row['seconds'] : 0;

    // 2. Study time from Pomodoro yesterday (up to this time)
    // We check activity_log for sessions started yesterday before the current time cutoff
    $pomodoro_sql = "
        SELECT activity_details 
        FROM activity_log 
        WHERE activity_type = 'pomodoro_session' 
        AND timestamp BETWEEN '$yesterday_start' AND '$yesterday_current_cutoff'";
    
    $pomodoro_res = $conn->query($pomodoro_sql);
    $pomodoro_seconds = 0;
    
    if ($pomodoro_res) {
        while ($row = $pomodoro_res->fetch_assoc()) {
            // Attempt to extract duration from JSON or default to 25 mins
            $details = json_decode($row['activity_details'], true);
            $duration_mins = isset($details['duration']) ? (int)$details['duration'] : 25;
            $pomodoro_seconds += ($duration_mins * 60);
        }
    }

    $total_yesterday_seconds = $exam_seconds + $pomodoro_seconds;

    echo json_encode([
        'success' => true,
        'yesterday_total_seconds' => $total_yesterday_seconds,
        'yesterday_formatted' => floor($total_yesterday_seconds / 3600) . 'h ' . floor(($total_yesterday_seconds % 3600) / 60) . 'm',
        'cutoff_time' => $current_time
    ]);

} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}

$conn->close();
?>
