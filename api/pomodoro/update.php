<?php
header('Content-Type: application/json');
require_once '../subject/db_connect.php';

date_default_timezone_set('Asia/Dhaka');

$data = json_decode(file_get_contents('php://input'), true);
$action = $data['action'] ?? null; // 'pause', 'resume', 'update'
$remaining = $data['remaining_seconds'] ?? null;
$session_id = $data['session_id'] ?? null;

// We update the session based on session_id if provided.

try {
    if ($action === 'pause') {
        if ($session_id) {
            $stmt = $conn->prepare("UPDATE study_sessions SET status = 'paused', remaining_seconds = ?, last_heartbeat = NOW() WHERE id = ? AND status = 'active'");
            $stmt->bind_param("ii", $remaining, $session_id);
        } else {
            $stmt = $conn->prepare("UPDATE study_sessions SET status = 'paused', remaining_seconds = ?, last_heartbeat = NOW() WHERE status = 'active' ORDER BY id DESC LIMIT 1");
            $stmt->bind_param("i", $remaining);
        }
        $stmt->execute();
    } 
    elseif ($action === 'resume') {
        if ($session_id) {
            // Shift start_time forward by the gap between pause (last_heartbeat) and now
            $stmt = $conn->prepare("UPDATE study_sessions SET start_time = TIMESTAMPADD(SECOND, TIMESTAMPDIFF(SECOND, last_heartbeat, NOW()), start_time), status = 'active', last_heartbeat = NOW() WHERE id = ? AND status = 'paused'");
            $stmt->bind_param("i", $session_id);
            $stmt->execute();
        } else {
            $conn->query("UPDATE study_sessions SET start_time = TIMESTAMPADD(SECOND, TIMESTAMPDIFF(SECOND, last_heartbeat, NOW()), start_time), status = 'active', last_heartbeat = NOW() WHERE status = 'paused' ORDER BY id DESC LIMIT 1");
        }
    } 
    elseif ($action === 'update') {
        if ($session_id) {
            $stmt = $conn->prepare("UPDATE study_sessions SET remaining_seconds = ?, last_heartbeat = NOW() WHERE id = ? AND status = 'active'");
            $stmt->bind_param("ii", $remaining, $session_id);
        } else {
            $stmt = $conn->prepare("UPDATE study_sessions SET remaining_seconds = ?, last_heartbeat = NOW() WHERE status = 'active' ORDER BY id DESC LIMIT 1");
            $stmt->bind_param("i", $remaining);
        }
        $stmt->execute();
    }

    echo json_encode(['success' => true, 'affected_rows' => $conn->affected_rows]);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}

$conn->close();
?>
