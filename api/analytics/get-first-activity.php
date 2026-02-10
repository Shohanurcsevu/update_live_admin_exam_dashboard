<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
require_once '../subject/db_connect.php';

date_default_timezone_set('Asia/Dhaka');

try {
    $sql = "SELECT timestamp 
            FROM activity_log 
            WHERE DATE(timestamp) = CURRENT_DATE 
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
