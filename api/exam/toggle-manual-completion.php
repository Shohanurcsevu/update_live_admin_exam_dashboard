<?php
// FILE: api/exam/toggle-manual-completion.php
require_once '../subject/db_connect.php';
header('Content-Type: application/json');

// Ensure POST request
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'error' => 'Invalid request method']);
    exit;
}

// Get input
$data = json_decode(file_get_contents('php://input'), true);
if (!isset($data['exam_id'])) {
    echo json_encode(['success' => false, 'error' => 'Missing exam_id']);
    exit;
}

$exam_id = intval($data['exam_id']);
$date = isset($data['date']) ? $data['date'] : date('Y-m-d');

// We use activity_log to store manual completions
// Type: 'manual_exam_completion'
// Message: JSON string containing exam_id and date

$activity_type = 'manual_exam_completion';
// Search specifically for this exam on this date
$search_pattern = '%"exam_id":' . $exam_id . '%"date":"' . $date . '"%';

// Check if it exists
$check_sql = "SELECT id FROM activity_log WHERE activity_type = ? AND activity_message LIKE ? AND DATE(timestamp) = ?";
$stmt = $conn->prepare($check_sql);
$stmt->bind_param("sss", $activity_type, $search_pattern, $date);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows > 0) {
    // Exists -> Delete (Uncheck)
    // Deleting by a specific pattern is safer to avoid deleting duplicates if any crazy race condition happened
    $delete_sql = "DELETE FROM activity_log WHERE activity_type = ? AND activity_message LIKE ? AND DATE(timestamp) = ?";
    $del_stmt = $conn->prepare($delete_sql);
    $del_stmt->bind_param("sss", $activity_type, $search_pattern, $date);
    if ($del_stmt->execute()) {
        echo json_encode(['success' => true, 'status' => 'uncompleted']);
    } else {
        echo json_encode(['success' => false, 'error' => 'Failed to remove completion']);
    }
} else {
    // Not exists -> Insert (Check)
    $message_data = [
        'exam_id' => $exam_id,
        'date' => $date
    ];
    $message = json_encode($message_data);
    
    $insert_sql = "INSERT INTO activity_log (activity_type, activity_message, timestamp) VALUES (?, ?, NOW())";
    $ins_stmt = $conn->prepare($insert_sql);
    $ins_stmt->bind_param("ss", $activity_type, $message);
    
    if ($ins_stmt->execute()) {
        echo json_encode(['success' => true, 'status' => 'completed']);
    } else {
        echo json_encode(['success' => false, 'error' => 'Failed to record completion']);
    }
}

$conn->close();
?>
