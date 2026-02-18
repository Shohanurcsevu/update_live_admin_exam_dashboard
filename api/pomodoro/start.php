<?php
header('Content-Type: application/json');
require_once '../subject/db_connect.php';

date_default_timezone_set('Asia/Dhaka');

$data = json_decode(file_get_contents('php://input'), true);
$subject_id = $data['subject_id'] ?? null;
$subject_name = $data['subject_name'] ?? null; // Nullable for breaks
$duration = $data['duration'] ?? 25;
$type = $data['type'] ?? 'focus'; // Default to focus

// Validation: Subject required only for focus
if ($type === 'focus' && !$subject_id) {
    echo json_encode(['success' => false, 'error' => 'Subject ID required for focus sessions']);
    exit;
}

try {
    // 1. Abandon any existing active or completed sessions that are awaiting decision
    $conn->query("UPDATE study_sessions SET status = 'abandoned' WHERE status IN ('active', 'paused', 'completed')");

    // 2. Create new session
    $stmt = $conn->prepare("INSERT INTO study_sessions (subject_id, subject_name, duration_minutes, remaining_seconds, status, start_time, last_heartbeat, session_type) VALUES (?, ?, ?, ?, 'active', NOW(), NOW(), ?)");
    
    $seconds = $duration * 60;
    $stmt->bind_param("isiis", $subject_id, $subject_name, $duration, $seconds, $type);
    
    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'session_id' => $conn->insert_id]);
    } else {
        throw new Exception($stmt->error);
    }
} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}

$conn->close();
?>
