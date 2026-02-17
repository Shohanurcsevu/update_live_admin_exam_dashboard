<?php
header('Content-Type: application/json');
require_once '../subject/db_connect.php';

date_default_timezone_set('Asia/Dhaka');

$data = json_decode(file_get_contents('php://input'), true);
$action = $data['action'] ?? null; // 'pause', 'resume', 'update'
$remaining = $data['remaining_seconds'] ?? null;

// Implicitly we update the single active session. 
// A more robust system would pass session_id, but per user requirement "no user", we assume single session context.

try {
    if ($action === 'pause') {
        $stmt = $conn->prepare("UPDATE study_sessions SET status = 'paused', remaining_seconds = ?, last_heartbeat = NOW() WHERE status = 'active' ORDER BY id DESC LIMIT 1");
        $stmt->bind_param("i", $remaining);
        $stmt->execute();
    } 
    elseif ($action === 'resume') {
        // When resuming, we don't necessarily update remaining time from client (trust server or client? client has latest timer tick)
        // But usually we just flip status.
        $conn->query("UPDATE study_sessions SET status = 'active', last_heartbeat = NOW() WHERE status = 'paused' ORDER BY id DESC LIMIT 1");
    } 
    elseif ($action === 'update') {
        // Regular heartbeat
        $stmt = $conn->prepare("UPDATE study_sessions SET remaining_seconds = ?, last_heartbeat = NOW() WHERE status = 'active' ORDER BY id DESC LIMIT 1");
        $stmt->bind_param("i", $remaining);
        $stmt->execute();
    }

    echo json_encode(['success' => true, 'affected_rows' => $conn->affected_rows]);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}

$conn->close();
?>
