<?php
header('Content-Type: application/json');
require_once '../subject/db_connect.php';
date_default_timezone_set('Asia/Dhaka');

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

$debug = [];
$debug['php_time'] = date('Y-m-d H:i:s');
$debug['php_date'] = date('Y-m-d');
$debug['logical_study_day'] = "$start_ts to $end_ts";

// Check MySQL Time
$time_res = $conn->query("SELECT NOW() as mysql_now, CURRENT_DATE as mysql_today, @@session.time_zone as session_tz, @@global.time_zone as global_tz");
$debug['mysql_info'] = $time_res->fetch_assoc();

// Check Performance Table for Today (5 AM boundary)
$perf_res = $conn->query("SELECT COUNT(*) as count, SUM(time_used_seconds) as total_seconds FROM performance WHERE attempt_time BETWEEN '$start_ts' AND '$end_ts'");
$debug['today_performance_summary'] = $perf_res->fetch_assoc();

// Check Activity Log for Today (5 AM boundary)
$act_res = $conn->query("SELECT COUNT(*) as count FROM activity_log WHERE timestamp BETWEEN '$start_ts' AND '$end_ts'");
$debug['today_activity_summary'] = $act_res->fetch_assoc();

// Check JSON Support
$json_test = $conn->query("SELECT JSON_VALID('{\"test\":1}') as valid, JSON_EXTRACT('{\"test\":1}', '$.test') as val");
$debug['mysql_json_support'] = $json_test ? $json_test->fetch_assoc() : "Not Supported or Query Failed: " . $conn->error;

// Try catching any error during JSON processing
try {
    $sum_test = $conn->query("SELECT SUM(JSON_UNQUOTE(JSON_EXTRACT(activity_details, '$.duration'))) as sum FROM activity_log WHERE activity_type = 'pomodoro_session' AND timestamp BETWEEN '$start_ts' AND '$end_ts'");
    $debug['pomodoro_sum_test'] = $sum_test ? $sum_test->fetch_assoc() : "Failed: " . $conn->error;
} catch (Exception $e) {
    $debug['pomodoro_sum_error'] = $e->getMessage();
}

echo json_encode($debug, JSON_PRETTY_PRINT);
?>
