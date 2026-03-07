<?php
header('Content-Type: application/json');
require_once '../subject/db_connect.php';

$date = $_GET['date'] ?? date('Y-m-d', strtotime('yesterday'));

// Fetch BPM logs for the specified day
$stmt = $conn->prepare("
    SELECT 
        bpm_value, 
        is_active, 
        HOUR(timestamp) + MINUTE(timestamp)/60 as hour_val 
    FROM bpm_logs 
    WHERE DATE(timestamp) = ?
");

$stmt->bind_param("s", $date);
$stmt->execute();
$result = $stmt->get_result();

$logs = [];
while ($row = $result->fetch_assoc()) {
    $logs[] = [
        'bpm' => (int)$row['bpm_value'],
        'isActive' => (bool)$row['is_active'],
        'hour' => (float)$row['hour_val']
    ];
}

echo json_encode(['success' => true, 'date' => $date, 'logs' => $logs]);

$stmt->close();
$conn->close();
