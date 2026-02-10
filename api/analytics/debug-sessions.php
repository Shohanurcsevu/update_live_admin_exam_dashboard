<?php
header('Content-Type: application/json');
require_once '../subject/db_connect.php';
date_default_timezone_set('Asia/Dhaka');

$debug = [];
$debug['php_time'] = date('Y-m-d H:i:s');
$debug['php_date'] = date('Y-m-d');

// Check MySQL Time
$time_res = $conn->query("SELECT NOW() as mysql_now, CURRENT_DATE as mysql_today, @@session.time_zone as session_tz, @@global.time_zone as global_tz");
$debug['mysql_info'] = $time_res->fetch_assoc();

// Check Performance Table for Today
$perf_res = $conn->query("SELECT COUNT(*) as count, SUM(time_used_seconds) as total_seconds FROM performance WHERE DATE(attempt_time) = CURRENT_DATE");
$debug['today_performance_summary'] = $perf_res->fetch_assoc();

// Check Activity Log for Today
$act_res = $conn->query("SELECT COUNT(*) as count FROM activity_log WHERE DATE(timestamp) = CURRENT_DATE");
$debug['today_activity_summary'] = $act_res->fetch_assoc();

// Check JSON Support
$json_test = $conn->query("SELECT JSON_VALID('{\"test\":1}') as valid, JSON_EXTRACT('{\"test\":1}', '$.test') as val");
$debug['mysql_json_support'] = $json_test ? $json_test->fetch_assoc() : "Not Supported or Query Failed: " . $conn->error;

// Test duration extraction specifically
if (!empty($debug['today_pomodoro_sessions'])) {
    $first_id = $debug['today_pomodoro_sessions'][0]['id'];
    $dur_test = $conn->query("SELECT JSON_UNQUOTE(JSON_EXTRACT(activity_details, '$.duration')) as dur FROM activity_log WHERE id = $first_id");
    $debug['duration_extraction_test'] = $dur_test ? $dur_test->fetch_assoc() : "Failed: " . $conn->error;
}

// Try catching any error during JSON processing
try {
    $sum_test = $conn->query("SELECT SUM(JSON_UNQUOTE(JSON_EXTRACT(activity_details, '$.duration'))) as sum FROM activity_log WHERE activity_type = 'pomodoro_session' AND DATE(timestamp) = CURRENT_DATE");
    $debug['pomodoro_sum_test'] = $sum_test ? $sum_test->fetch_assoc() : "Failed: " . $conn->error;
} catch (Exception $e) {
    $debug['pomodoro_sum_error'] = $e->getMessage();
}

echo json_encode($debug, JSON_PRETTY_PRINT);
?>
