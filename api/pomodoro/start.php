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
    // 1. Abandon only current in-progress sessions (active/paused) when starting a new one.
    // DO NOT abandon 'completed' or 'finished' sessions as they are part of the daily tally.
    $conn->query("UPDATE study_sessions SET status = 'abandoned' WHERE status IN ('active', 'paused')");

    // 2. Create new session
    $stmt = $conn->prepare("INSERT INTO study_sessions (subject_id, subject_name, duration_minutes, remaining_seconds, status, start_time, last_heartbeat, session_type) VALUES (?, ?, ?, ?, 'active', NOW(), NOW(), ?)");
    
    $seconds = $duration * 60;
    $stmt->bind_param("isiis", $subject_id, $subject_name, $duration, $seconds, $type);
    
    if ($stmt->execute()) {
        $sessionId = $conn->insert_id;
        
        // Count today's completed focus sessions using JSON_EXTRACT on activity_details
        // Filters by subject_id and status in SQL — no subject_name encoding issues
        $completedToday = 0;
        if ($subject_id) {
            $now = time();
            $hour = intval(date('G', $now));
            if ($hour < 5) {
                $studyDate = date('Y-m-d', strtotime('yesterday'));
            } else {
                $studyDate = date('Y-m-d', $now);
            }

            $today_start = $studyDate . ' 05:00:00';
            $today_end   = date('Y-m-d', strtotime($studyDate . ' +1 day')) . ' 05:00:00';
            $currentSubjectId = intval($subject_id);

            $countSql = "SELECT COUNT(*) as total FROM activity_log 
                         WHERE activity_type = 'pomodoro_session'
                         AND timestamp BETWEEN ? AND ?
                         AND JSON_UNQUOTE(JSON_EXTRACT(activity_details, '$.subject_id')) = ?
                         AND (
                             JSON_EXTRACT(activity_details, '$.status') IS NULL
                             OR JSON_UNQUOTE(JSON_EXTRACT(activity_details, '$.status')) = 'completed'
                         )";
            $countStmt = $conn->prepare($countSql);
            $countStmt->bind_param("ssi", $today_start, $today_end, $currentSubjectId);
            $countStmt->execute();
            $countRes = $countStmt->get_result();
            if ($countRow = $countRes->fetch_assoc()) {
                $completedToday = intval($countRow['total']);
            }
        }

        echo json_encode([
            'success' => true, 
            'session_id' => $sessionId,
            'completed_today' => $completedToday
        ]);
    } else {
        throw new Exception($stmt->error);
    }
} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}

$conn->close();
?>
