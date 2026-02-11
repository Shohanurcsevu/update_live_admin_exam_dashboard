<?php
header('Content-Type: application/json');
require_once '../subject/db_connect.php';

date_default_timezone_set('Asia/Dhaka');

$data = json_decode(file_get_contents('php://input'), true);
// Even if we don't pass ID, complete the active one
$remaining = $data['remaining_seconds'] ?? 0;
$customDuration = isset($data['duration']) ? floatval($data['duration']) : null;

try {
    // 1. Get the active session to log it correctly
    $sql = "SELECT * FROM study_sessions WHERE status IN ('active', 'paused') ORDER BY id DESC LIMIT 1";
    $result = $conn->query($sql);
    
    if ($row = $result->fetch_assoc()) {
        // 2. Mark as completed
        $update = $conn->prepare("UPDATE study_sessions SET status = 'completed', remaining_seconds = 0, last_heartbeat = NOW() WHERE id = ?");
        $update->bind_param("i", $row['id']);
        $update->execute();

        // 3. Log to activity_log (standard logging)
        // We reuse the existing /api/log-activity.php logic or insert directly.
        // Inserting directly is safer transactionally here.
        
        $logSql = "INSERT INTO activity_log (activity_type, activity_message, activity_details, timestamp) VALUES ('pomodoro_session', ?, ?, NOW())";
        
        $durationToLog = ($customDuration !== null) ? $customDuration : floatval($row['duration_minutes']);
        
        $details = json_encode([
            'duration' => $durationToLog,
            'subject_id' => $row['subject_id'],
            'completed_at' => date('Y-m-d H:i:s')
        ]);
        
        $logStmt = $conn->prepare($logSql);
        $logStmt->bind_param("ss", $row['subject_name'], $details);
        $logStmt->execute();
        
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'error' => 'No active session found']);
    }

} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}

$conn->close();
?>
