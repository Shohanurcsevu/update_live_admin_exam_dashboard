<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
require_once '../subject/db_connect.php';

date_default_timezone_set('Asia/Dhaka');

try {
    // Helper to get study date (rollover at 5 AM)
    function get_study_date() {
        $now = time();
        $hour = intval(date('G', $now));
        if ($hour < 5) {
            return date('Y-m-d', strtotime('yesterday'));
        }
        return date('Y-m-d', $now);
    }
    
    $study_date = get_study_date();
    $next_date = date('Y-m-d', strtotime($study_date . ' +1 day'));
    $start_ts = $study_date . ' 05:00:00';
    $end_ts = $next_date . ' 05:00:00';

    $sql = "SELECT timestamp 
            FROM activity_log 
            WHERE timestamp BETWEEN '$start_ts' AND '$end_ts' 
            AND (activity_type LIKE '%Exam%' OR activity_type LIKE '%pomodoro%' OR activity_type LIKE '%Subject%')
            ORDER BY timestamp ASC 
            LIMIT 1";
            
    $result = $conn->query($sql);
    
    if ($result && $row = $result->fetch_assoc()) {
        echo json_encode([
            'success' => true,
            'timestamp' => $row['timestamp']
        ]);
    } else {
        echo json_encode([
            'success' => false,
            'message' => 'No activity found today'
        ]);
    }
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}

$conn->close();
?>
