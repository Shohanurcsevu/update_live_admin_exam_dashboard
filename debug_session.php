<?php
require_once 'api/subject/db_connect.php';
header('Content-Type: application/json');
date_default_timezone_set('Asia/Dhaka');

// 1. Try to insert a test session manually
$type = 'pomodoro_session';
$message = 'Test Subject via Script';
$details = json_encode(['source' => 'debug_script']);

$sql = "INSERT INTO activity_log (activity_type, activity_message, activity_details, timestamp) VALUES (?, ?, ?, NOW())";
$stmt = $conn->prepare($sql);
$stmt->bind_param("sss", $type, $message, $details);

$insert_success = $stmt->execute();
$error = $stmt->error;
$stmt->close();

// 2. Check the count immediately after
$today = date('Y-m-d');
$today_start = $today . ' 00:00:00';
$today_end = $today . ' 23:59:59';

$count_sql = "SELECT COUNT(*) as total FROM activity_log WHERE activity_type = 'pomodoro_session' AND timestamp BETWEEN '$today_start' AND '$today_end'";
$res = $conn->query($count_sql);
$count = ($res) ? $res->fetch_assoc()['total'] : -1;

echo json_encode([
    'insert_success' => $insert_success,
    'insert_error' => $error,
    'current_session_count' => $count,
    'timestamp_used' => date('Y-m-d H:i:s'),
    'timezone' => date_default_timezone_get()
]);
?>
