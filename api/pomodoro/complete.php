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

            // --- Telegram Notification (only for naturally completed focus sessions) ---
            if ($targetStatus === 'completed' && $sessionType === 'focus') {
                $tgToken = null;
                $tgChatId = null;
                $tgStmt = $conn->prepare("SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN ('telegram_bot_token', 'telegram_chat_id')");
                $tgStmt->execute();
                $tgRes = $tgStmt->get_result();
                while ($tgRow = $tgRes->fetch_assoc()) {
                    if ($tgRow['setting_key'] === 'telegram_bot_token') $tgToken = $tgRow['setting_value'];
                    if ($tgRow['setting_key'] === 'telegram_chat_id') $tgChatId = $tgRow['setting_value'];
                }

                if ($tgToken && $tgChatId) {
                    $subjectName = $row['subject_name'] ?? 'Unknown';
                    $durationMin = $durationToLog;
                    $timeNow = date('h:i A');

                    // Count today's completed sessions for this subject
                    $sessionNum = 1;
                    if ($row['subject_id']) {
                        $today = date('Y-m-d');
                        $cStmt = $conn->prepare("SELECT COUNT(*) as total FROM activity_log 
                            WHERE activity_type = 'pomodoro_session'
                            AND timestamp BETWEEN ? AND ?
                            AND JSON_UNQUOTE(JSON_EXTRACT(activity_details, '$.subject_id')) = ?
                            AND (JSON_EXTRACT(activity_details, '$.status') IS NULL OR JSON_UNQUOTE(JSON_EXTRACT(activity_details, '$.status')) = 'completed')");
                        $tStart = $today . ' 00:00:00';
                        $tEnd = $today . ' 23:59:59';
                        $sId = intval($row['subject_id']);
                        $cStmt->bind_param("ssi", $tStart, $tEnd, $sId);
                        $cStmt->execute();
                        $cRow = $cStmt->get_result()->fetch_assoc();
                        if ($cRow) $sessionNum = intval($cRow['total']);
                    }

                    $tgMessage = "✅ Pomodoro Complete!\n"
                               . "📚 Subject: {$subjectName}\n"
                               . "🔢 Session: #{$sessionNum} today\n"
                               . "⏱ Duration: {$durationMin} min\n"
                               . "🕐 Completed at {$timeNow}";

                    $tgUrl = "https://api.telegram.org/bot{$tgToken}/sendMessage";
                    $ch = curl_init();
                    curl_setopt($ch, CURLOPT_URL, $tgUrl);
                    curl_setopt($ch, CURLOPT_POST, true);
                    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
                        'chat_id' => $tgChatId,
                        'text' => $tgMessage
                    ]));
                    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
                    curl_setopt($ch, CURLOPT_TIMEOUT, 5);
                    @curl_exec($ch);
                }
            }
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
