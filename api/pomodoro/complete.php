<?php
header('Content-Type: application/json');
require_once '../subject/db_connect.php';

date_default_timezone_set('Asia/Dhaka');

$data = json_decode(file_get_contents('php://input'), true);
// Even if we don't pass ID, complete the active one
$remaining = $data['remaining_seconds'] ?? 0;
$customDuration = isset($data['duration']) ? floatval($data['duration']) : null;
$session_id = $data['session_id'] ?? null;

try {
    // 1. Get the active or recently completed session to log it or update its status
    if ($session_id) {
        $sql = "SELECT * FROM study_sessions WHERE id = ? AND status IN ('active', 'paused', 'completed', 'skipped', 'finished', 'dismissed')";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param("i", $session_id);
        $stmt->execute();
        $result = $stmt->get_result();
    } else {
        $sql = "SELECT * FROM study_sessions WHERE status IN ('active', 'paused', 'completed', 'skipped', 'finished', 'dismissed') ORDER BY id DESC LIMIT 1";
        $result = $conn->query($sql);
    }
    
    if ($row = $result->fetch_assoc()) {
        $targetStatus = $data['status'] ?? 'completed';
        
        // 2. Mark with target status (e.g. 'completed' for auto, 'finished' for manual stop)
        // CRITICAL: Prevent auto-completion if the session is currently paused on any device
        if ($targetStatus === 'completed' && $row['status'] === 'paused') {
            echo json_encode(['success' => false, 'error' => 'Cannot auto-complete a paused session', 'is_paused' => true]);
            exit;
        }

        $update = $conn->prepare("UPDATE study_sessions SET status = ?, remaining_seconds = 0, last_heartbeat = NOW() WHERE id = ?");
        $update->bind_param("si", $targetStatus, $row['id']);
        $update->execute();

        // 3. Log to activity_log (ONLY if it was just completed from active/paused state)
        if (in_array($row['status'], ['active', 'paused'])) {
            $sessionType = $row['session_type'] ?? 'focus';
            $activityType = ($sessionType === 'break') ? 'pomodoro_break' : 'pomodoro_session';
            $logSql = "INSERT INTO activity_log (activity_type, activity_message, activity_details, timestamp) VALUES ('$activityType', ?, ?, NOW())";
            
            $durationToLog = ($customDuration !== null) ? $customDuration : floatval($row['duration_minutes']);
            
            $details = json_encode([
                'duration' => $durationToLog,
                'subject_id' => $row['subject_id'],
                'status' => $targetStatus,
                'completed_at' => date('Y-m-d H:i:s')
            ]);
            
            $logStmt = $conn->prepare($logSql);
            $logStmt->bind_param("ss", $row['subject_name'], $details);
            $logStmt->execute();
        }
        
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'error' => 'No active session found']);
    }

} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}

$conn->close();
?>
