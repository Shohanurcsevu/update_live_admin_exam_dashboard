<?php
header('Content-Type: application/json');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Cache-Control: post-check=0, pre-check=0', false);
header('Pragma: no-cache');
require_once '../subject/db_connect.php';

date_default_timezone_set('Asia/Dhaka');

try {
    // Fetch the single latest session regardless of status to avoid fallback to older completed sessions
    $sql = "SELECT id, subject_id, subject_name, remaining_seconds, status, duration_minutes, last_heartbeat, UNIX_TIMESTAMP(last_heartbeat) as last_heartbeat_timestamp, session_type 
            FROM study_sessions 
            ORDER BY id DESC LIMIT 1";
    $result = $conn->query($sql);

    if ($row = $result->fetch_assoc()) {
        // Valid if active/paused OR completed within the last hour
        $isRecentlyCompleted = ($row['status'] === 'completed' && strtotime($row['last_heartbeat']) >= time() - 3600);
        $isActiveOrPaused = in_array($row['status'], ['active', 'paused']);

        if ($isActiveOrPaused || $isRecentlyCompleted) {
        // Logic to calculate offline elapsed time IF needed (not for paused)
        // For 'active' sessions, if user closed tab, time logically kept ticking? 
        // Or do we validly resume from last heartbeat? 
        // User said: "resume from where I left off" implying strict pause on close OR accurate resume.
        // "Resume it from there" usually means time didn't vanish. 
        // However, standard Pomodoro keeps running. 
        // Let's trust the `remaining_seconds` stored at last heartbeat/update for now. 
        // If we want "realtime" catchup, we'd diff `NOW() - last_heartbeat`.
        
        // Let's implement robust catch-up:
        // If status is 'active', subtract elapsed time since last_heartbeat.
        if ($row['status'] === 'active') {
            $last_hb = strtotime($row['last_heartbeat']);
            $now = time();
            $elapsed = $now - $last_hb;
            
            // If elapsed is huge (e.g. > 10 mins without update), maybe auto-pause or abandon? 
            // For now, let's just subtract it to show "true" time passing.
            // BUT user said "accidentally close... resume it from there". 
            // If I close tab for 10 mins, should timer lose 10 mins? 
            // Usually yes for Pomodoro. But "resume from there" suggests PAUSE on close behavior or saving state.
            // The safest interpretation of "resume from there" on accidental close is:
            // The timer state was saved.
            
            // We will return the stored remaining_seconds. 
            // The client can decide if it wants to subtract elapsed time or not.
            // Given the requirement "resume it from there", preserving the seconds seems desired.
            
            // NOTE: To prevent "active" session from seeming stalled, we'll return it as is.
        }

        // Fetch daily count for this subject to keep multiple devices in sync on session number
        $completedToday = 0;
        if ($row['subject_id']) {
            $countSql = "SELECT COUNT(*) as total FROM study_sessions 
                         WHERE subject_id = ? AND status = 'completed' 
                         AND DATE(last_heartbeat) = CURDATE()";
            $countStmt = $conn->prepare($countSql);
            $countStmt->bind_param("i", $row['subject_id']);
            $countStmt->execute();
            $countRes = $countStmt->get_result();
            if ($countRow = $countRes->fetch_assoc()) {
                $completedToday = intval($countRow['total']);
            }
        }

        echo json_encode(['success' => true, 'session' => $row, 'server_time' => time(), 'completed_today' => $completedToday]);
        exit;
    }
}

echo json_encode(['success' => true, 'session' => null, 'server_time' => time()]);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}

$conn->close();
?>
