<?php
header('Content-Type: application/json');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Cache-Control: post-check=0, pre-check=0', false);
header('Pragma: no-cache');
require_once '../subject/db_connect.php';

date_default_timezone_set('Asia/Dhaka');

// Always fetch sound toggle status regardless of session state
$soundEnabled = 'true'; // Default
$soundStmt = $conn->prepare("SELECT setting_value FROM app_settings WHERE setting_key = 'study_mentor_sound_enabled'");
$soundStmt->execute();
$soundRes = $soundStmt->get_result();
if ($soundRow = $soundRes->fetch_assoc()) {
    $soundEnabled = $soundRow['setting_value'];
}

try {
    // Fetch the single latest session regardless of status
    $sql = "SELECT id, subject_id, subject_name, remaining_seconds, status, duration_minutes, last_heartbeat, UNIX_TIMESTAMP(last_heartbeat) as last_heartbeat_timestamp, session_type 
            FROM study_sessions 
            ORDER BY id DESC LIMIT 1";
    $result = $conn->query($sql);

    if ($row = $result->fetch_assoc()) {
        $isRecentlyCompleted = (in_array($row['status'], ['completed', 'finished', 'skipped', 'dismissed']) && strtotime($row['last_heartbeat']) >= time() - 3600);
        $isActiveOrPaused = in_array($row['status'], ['active', 'paused']);

        if ($isActiveOrPaused || $isRecentlyCompleted) {
            $completedToday = 0;
            if ($row['subject_id']) {
                $now = time();
                $hour = intval(date('G', $now));
                if ($hour < 5) {
                    $studyDate = date('Y-m-d', strtotime('yesterday'));
                } else {
                    $studyDate = date('Y-m-d', $now);
                }
                
                $today_start = $studyDate . ' 05:00:00';
                $today_end   = date('Y-m-d', strtotime($studyDate . ' +1 day')) . ' 05:00:00';
                $sessionSubjectId = intval($row['subject_id']);

                $countSql = "SELECT COUNT(*) as total FROM activity_log 
                             WHERE activity_type = 'pomodoro_session'
                             AND timestamp BETWEEN ? AND ?
                             AND JSON_UNQUOTE(JSON_EXTRACT(activity_details, '$.subject_id')) = ?
                             AND (
                                 JSON_EXTRACT(activity_details, '$.status') IS NULL
                                 OR JSON_UNQUOTE(JSON_EXTRACT(activity_details, '$.status')) = 'completed'
                             )";
                $countStmt = $conn->prepare($countSql);
                $countStmt->bind_param("ssi", $today_start, $today_end, $sessionSubjectId);
                $countStmt->execute();
                $countRes = $countStmt->get_result();
                if ($countRow = $countRes->fetch_assoc()) {
                    $completedToday = intval($countRow['total']);
                }
            }

            echo json_encode([
                'success' => true, 
                'session' => $row, 
                'server_time' => time(), 
                'completed_today' => $completedToday,
                'study_mentor_sound_enabled' => $soundEnabled
            ]);
            exit;
        }
    }

    echo json_encode([
        'success' => true, 
        'session' => null, 
        'server_time' => time(),
        'study_mentor_sound_enabled' => $soundEnabled
    ]);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}

$conn->close();
?>
