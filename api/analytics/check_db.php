<?php
require_once '../subject/db_connect.php';

try {
    $res1 = $conn->query("SELECT MAX(timestamp) as last_activity FROM activity_log WHERE (activity_type LIKE '%Exam%' OR activity_type LIKE '%pomodoro%')");
    $row1 = $res1->fetch_assoc();
    
    $res2 = $conn->query("SELECT MAX(attempt_time) as last_activity FROM performance");
    $row2 = $res2->fetch_assoc();
    
    echo json_encode([
        'activity_log_last' => $row1['last_activity'],
        'performance_last' => $row2['last_activity']
    ]);
} catch (Exception $e) {
    echo $e->getMessage();
}
?>
