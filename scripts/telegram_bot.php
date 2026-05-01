<?php
/**
 * Telegram Pomodoro Controller
 * Long-polling script to manage Pomodoro sessions via Telegram.
 */

if (php_sapi_name() !== 'cli') {
    die("This script must be run from the command line.");
}

// Ensure working directory is the project root
chdir(dirname(__DIR__));

// Suppress header warnings from db_connect.php
ob_start();
require_once 'api/subject/db_connect.php';
ob_end_clean();

date_default_timezone_set('Asia/Dhaka');

// --- Load Telegram Credentials ---
$tgToken = null;
$tgChatId = null;
$stmt = $conn->prepare("SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN ('telegram_bot_token', 'telegram_chat_id')");
$stmt->execute();
$res = $stmt->get_result();
while ($row = $res->fetch_assoc()) {
    if ($row['setting_key'] === 'telegram_bot_token')
        $tgToken = $row['setting_value'];
    if ($row['setting_key'] === 'telegram_chat_id')
        $tgChatId = $row['setting_value'];
}

if (!$tgToken || !$tgChatId) {
    die("ERROR: Telegram credentials not found in app_settings. Run setup_telegram.php first.\n");
}

echo "--- Pomodoro Telegram Bot Started ---\n";
echo "Bot Token: " . substr($tgToken, 0, 10) . "...\n";
echo "Watching Chat ID: $tgChatId\n";
echo "Press Ctrl+C to stop.\n\n";

// --- Nudge System State ---
$nudgeActive = true;
$nudgeInterval = 300; // Start with 5 minutes
$lastNudgeTime = time();
$isNagMode = false;

$offset = 0;

while (true) {
    $updates = getTelegramUpdates($tgToken, $offset);

    if ($updates && isset($updates['result'])) {
        foreach ($updates['result'] as $update) {
            $offset = $update['update_id'] + 1;

            // 1. Handle Messages (Commands)
            if (isset($update['message'])) {
                $msg = $update['message'];
                $chatId = $msg['chat']['id'];

                // Only respond to the authorized chat ID
                if ($chatId != $tgChatId)
                    continue;

                $text = $msg['text'] ?? '';

                if (strpos($text, '/study') === 0 || $text === "📚 Start Study") {
                    handleStudyCommand($conn, $tgToken, $chatId);
                } elseif (strpos($text, '/stop') === 0 || $text === "🛑 Stop Session") {
                    handleStopCommand($conn, $tgToken, $chatId);
                } elseif (strpos($text, '/pause') === 0 || $text === "⏸ Pause") {
                    handlePauseCommand($conn, $tgToken, $chatId);
                } elseif (strpos($text, '/resume') === 0 || $text === "▶️ Resume") {
                    handleResumeCommand($conn, $tgToken, $chatId);
                } elseif (strpos($text, '/restart') === 0 || $text === "🔄 Restart Last") {
                    handleRestartLastCommand($conn, $tgToken, $chatId);
                } elseif (strpos($text, '/break') === 0 || $text === "☕ Start Break") {
                    handleBreakCommand($conn, $tgToken, $chatId);
                } elseif (strpos($text, '/status') === 0 || $text === "⏱ Status") {
                    handleStatusCommand($conn, $tgToken, $chatId);
                } elseif (strpos($text, '/repeat') === 0 || $text === "🔄 Repeat Last") {
                    handleRestartLastCommand($conn, $tgToken, $chatId);
                } elseif (strpos($text, '/report') === 0 || $text === "📊 Progress Report") {
                    handleProgressReport($conn, $tgToken, $chatId);
                } elseif (strpos($text, '/start') === 0) {
                    sendTgMessage($tgToken, $chatId, "👋 *Welcome to Rethink Pomodoro!*\nUse the keyboard below to control your study sessions.");
                }
            }

            // 2. Handle Callback Queries (Button Taps)
            if (isset($update['callback_query'])) {
                $cb = $update['callback_query'];
                $chatId = $cb['message']['chat']['id'];
                if ($chatId != $tgChatId)
                    continue;

                handleCallback($conn, $tgToken, $chatId, $cb);
            }
        }
    }

    // --- 3. Handle Automated Nudges ---
    if ($nudgeActive) {
        // Check for active sessions (Focus or Break)
        $sessionRes = $conn->query("SELECT id FROM study_sessions WHERE status IN ('active', 'paused') LIMIT 1");
        $hasActiveSession = ($sessionRes->num_rows > 0);

        if (!$hasActiveSession) {
            if (time() > ($lastNudgeTime + $nudgeInterval)) {
                $quote = getRandomMotivation();
                $keyboard = [
                    'inline_keyboard' => [
                        [['text' => "📚 Start Study", 'callback_data' => "start_study_menu"]],
                        [['text' => "⏳ Remind in 5m", 'callback_data' => "nudge_5m"], ['text' => "🛑 Stop Nudging", 'callback_data' => "nudge_stop"]]
                    ]
                ];

                sendTgMessage($tgToken, $tgChatId, "🔔 *Accountability Check*\n\n" . $quote, $keyboard);

                // Toggle Interval: 5m -> 1m -> 5m
                if (!$isNagMode) {
                    $nudgeInterval = 60; // Next is 1m nag
                    $isNagMode = true;
                } else {
                    $nudgeInterval = 300; // Reset to 5m
                    $isNagMode = false;
                }
                $lastNudgeTime = time();
            }
        } else {
            // Keep resetting lastNudgeTime while session is active so the first nudge 
            // happens 5m after the session actually ends.
            $lastNudgeTime = time();
            $nudgeInterval = 300;
            $isNagMode = false;
        }
    }

    usleep(500000); // Poll every 500ms
}

/**
 * Fetch updates from Telegram
 */
function getTelegramUpdates($token, $offset)
{
    $url = "https://api.telegram.org/bot{$token}/getUpdates?offset={$offset}&timeout=30";
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_TIMEOUT, 35);
    $response = curl_exec($ch);
    return json_decode($response, true);
}

/**
 * Send a message to Telegram
 */
function sendTgMessage($token, $chatId, $text, $keyboard = null)
{
    $url = "https://api.telegram.org/bot{$token}/sendMessage";
    $params = [
        'chat_id' => $chatId,
        'text' => $text,
        'parse_mode' => 'Markdown'
    ];
    if ($keyboard === null) {
        $keyboard = getMainMenu();
    }
    $params['reply_markup'] = json_encode($keyboard);

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($params));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_exec($ch);
}

/**
 * Respond to callback query
 */
function answerCallback($token, $callbackId, $text = "")
{
    $url = "https://api.telegram.org/bot{$token}/answerCallbackQuery";
    $params = [
        'callback_query_id' => $callbackId,
        'text' => $text
    ];
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($params));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_exec($ch);
}

/**
 * Handle /study command - list subjects
 */
function handleStudyCommand($conn, $token, $chatId)
{
    $sql = "SELECT id, subject_name FROM subjects WHERE is_deleted = 0 ORDER BY id ASC";
    $result = $conn->query($sql);

    if ($result->num_rows === 0) {
        sendTgMessage($token, $chatId, "❌ No subjects found. Please add subjects first.");
        return;
    }

    $buttons = [];
    $currentRow = [];
    while ($row = $result->fetch_assoc()) {
        $currentRow[] = [
            'text' => $row['subject_name'],
            'callback_data' => "start_" . $row['id']
        ];
        
        // Arrange buttons in 2 columns
        if (count($currentRow) === 2) {
            $buttons[] = $currentRow;
            $currentRow = [];
        }
    }
    
    // Catch any remaining single button
    if (!empty($currentRow)) {
        $buttons[] = $currentRow;
    }

    $keyboard = ['inline_keyboard' => $buttons];
    sendTgMessage($token, $chatId, "📚 *Select a subject to start studying:*", $keyboard);
}

/**
 * Handle /stop command
 */
function handleStopCommand($conn, $token, $chatId)
{
    $conn->query("UPDATE study_sessions SET status = 'abandoned' WHERE status IN ('active', 'paused')");

    if ($conn->affected_rows > 0) {
        sendTgMessage($token, $chatId, "🛑 *Session stopped.*");
    } else {
        sendTgMessage($token, $chatId, "⚠️ *No session is currently running.* Please start a session first.");
    }
}

/**
 * Handle /pause command
 */
function handlePauseCommand($conn, $token, $chatId)
{
    // 1. Calculate and update remaining_seconds for the active session
    $sql = "UPDATE study_sessions 
            SET remaining_seconds = GREATEST(0, (duration_minutes * 60) - TIMESTAMPDIFF(SECOND, start_time, NOW())),
                status = 'paused', 
                last_heartbeat = NOW() 
            WHERE status = 'active'
            ORDER BY id DESC LIMIT 1";

    if ($conn->query($sql) && $conn->affected_rows > 0) {
        sendTgMessage($token, $chatId, "⏸ *Session paused.*");
    } else {
        sendTgMessage($token, $chatId, "⚠️ No active session found to pause.");
    }
}

/**
 * Handle /resume command
 */
function handleResumeCommand($conn, $token, $chatId)
{
    // 2. Resume the latest paused session by shifting start_time forward
    // start_time = start_time + (NOW - last_heartbeat)
    $sql = "UPDATE study_sessions 
            SET start_time = TIMESTAMPADD(SECOND, TIMESTAMPDIFF(SECOND, last_heartbeat, NOW()), start_time), 
                status = 'active', 
                last_heartbeat = NOW() 
            WHERE status = 'paused' 
            ORDER BY id DESC LIMIT 1";

    if ($conn->query($sql) && $conn->affected_rows > 0) {
        sendTgMessage($token, $chatId, "▶️ *Session resumed.*");
    } else {
        sendTgMessage($token, $chatId, "⚠️ No paused session found to resume.");
    }
}

/**
 * Handle /restart command - start new session with last used subject
 */
function handleRestartLastCommand($conn, $token, $chatId)
{
    $res = $conn->query("SELECT subject_id, subject_name FROM study_sessions 
                         WHERE session_type = 'focus' AND subject_id IS NOT NULL 
                         ORDER BY id DESC LIMIT 1");

    if ($row = $res->fetch_assoc()) {
        $subjectId = $row['subject_id'];
        $subjectName = $row['subject_name'];

        // Safety check for active session
        $checkRes = $conn->query("SELECT subject_name FROM study_sessions WHERE status IN ('active', 'paused') LIMIT 1");
        if ($activeRow = $checkRes->fetch_assoc()) {
            $keyboard = [
                'inline_keyboard' => [
                    [
                        ['text' => "✅ Yes, restart", 'callback_data' => "confirm_start_" . $subjectId],
                        ['text' => "❌ No", 'callback_data' => "cancel"]
                    ]
                ]
            ];
            sendTgMessage($token, $chatId, "⚠️ *Conflict!*\nAn active session for *{$activeRow['subject_name']}* is running.\nRestart *{$subjectName}* anyway?", $keyboard);
        } else {
            startPomodoroSession($conn, $token, $chatId, $subjectId, $subjectName);
        }
    } else {
        sendTgMessage($token, $chatId, "❌ *No history found.* Please start a session manually first.");
    }
}

/**
 * Handle /break command
 */
function handleBreakCommand($conn, $token, $chatId)
{
    // Check if a session is currently running
    $checkRes = $conn->query("SELECT subject_name FROM study_sessions WHERE status IN ('active', 'paused') AND session_type = 'focus' LIMIT 1");
    if ($activeRow = $checkRes->fetch_assoc()) {
        sendTgMessage($token, $chatId, "⚠️ *Action Blocked!*\nYou are currently in a study session for *{$activeRow['subject_name']}*.\nFinish or Stop your session before taking a break.");
        return;
    }

    // If it's a break that's already running, don't restart it
    $breakRes = $conn->query("SELECT id FROM study_sessions WHERE status IN ('active', 'paused') AND session_type = 'break' LIMIT 1");
    if ($breakRes->num_rows > 0) {
        sendTgMessage($token, $chatId, "☕ *You are already on a break!*");
        return;
    }

    // Success: Start break
    $duration = 5; // 5 min break
    $seconds = $duration * 60;
    $stmt = $conn->prepare("INSERT INTO study_sessions (subject_id, subject_name, duration_minutes, remaining_seconds, status, start_time, last_heartbeat, session_type) VALUES (NULL, 'Break', ?, ?, 'active', NOW(), NOW(), 'break')");
    $stmt->bind_param("ii", $duration, $seconds);

    if ($stmt->execute()) {
        sendTgMessage($token, $chatId, "☕ *Break Started!*\n⏳ Duration: 5 min\nEnjoy your rest!");
    } else {
        sendTgMessage($token, $chatId, "❌ *Error starting break:* " . $conn->error);
    }
}

/**
 * Handle /status command
 */
function handleStatusCommand($conn, $token, $chatId)
{
    // 1. Get Logical Study Date (Rollover at 5 AM)
    $now = time();
    $hour = intval(date('G', $now));
    $studyDate = ($hour < 5) ? date('Y-m-d', strtotime('yesterday')) : date('Y-m-d', $now);
    $startTs = $studyDate . ' 05:00:00';
    $endTs = date('Y-m-d', strtotime($studyDate . ' +1 day')) . ' 05:00:00';

    // 2. Count sessions today
    $countRes = $conn->prepare("SELECT COUNT(*) as total FROM study_sessions WHERE session_type = 'focus' AND start_time BETWEEN ? AND ?");
    $countRes->bind_param("ss", $startTs, $endTs);
    $countRes->execute();
    $totalToday = $countRes->get_result()->fetch_assoc()['total'] ?? 0;

    // 3. Get current session details
    $sql = "SELECT *, 
            TIMESTAMPDIFF(SECOND, start_time, NOW()) as elapsed 
            FROM study_sessions 
            WHERE status IN ('active', 'paused') 
            ORDER BY id DESC LIMIT 1";

    $res = $conn->query($sql);
    if ($row = $res->fetch_assoc()) {
        $status = ucfirst($row['status']);

        if ($row['status'] === 'active') {
            $realRemaining = ($row['duration_minutes'] * 60) - $row['elapsed'];
            if ($realRemaining < 0)
                $realRemaining = 0;
        } else {
            $realRemaining = $row['remaining_seconds'];
        }

        $remain = floor($realRemaining / 60) . "m " . ($realRemaining % 60) . "s";
        $sessionNum = $totalToday; // Current one is included in count
        
        $msg = "⏱ *Current Status (Session #{$sessionNum})*\n";
        $msg .= "📖 Subject: *{$row['subject_name']}*\n";
        $msg .= "🔄 Status: {$status}\n";
        $msg .= "⏳ Time Left: {$remain}";
        
        sendTgMessage($token, $chatId, $msg);
    } else {
        sendTgMessage($token, $chatId, "🔌 *No active session.*\nToday's Total: {$totalToday} sessions.\nUse /study to start one.");
    }
}

/**
 * Handle /report command - show today's performance summary
 */
function handleProgressReport($conn, $token, $chatId)
{
    // 1. Get Logical Study Date (Rollover at 5 AM)
    $now = time();
    $hour = intval(date('G', $now));
    if ($hour < 5) {
        $studyDate = date('Y-m-d', strtotime('yesterday'));
    } else {
        $studyDate = date('Y-m-d', $now);
    }

    $startTs = $studyDate . ' 05:00:00';
    $endTs = date('Y-m-d', strtotime($studyDate . ' +1 day')) . ' 05:00:00';

    // 2. Fetch Streak Data (id=1 as per get-streak.php)
    $streak = 0;
    $res = $conn->query("SELECT current_streak FROM user_streaks WHERE id = 1");
    if ($row = $res->fetch_assoc()) {
        $streak = intval($row['current_streak']);
    }

    // 3. Calculate Total Focus time (Exams + Pomodoros)
    // Following logic from daily-study-time.php
    $totalSeconds = 0;

    // A. From Exams
    $sqlExams = "SELECT SUM(time_used_seconds) as total FROM performance WHERE attempt_time BETWEEN ? AND ?";
    $stmtExams = $conn->prepare($sqlExams);
    $stmtExams->bind_param("ss", $startTs, $endTs);
    $stmtExams->execute();
    if ($row = $stmtExams->get_result()->fetch_assoc()) {
        $totalSeconds += intval($row['total']);
    }

    // B. From Completed Pomodoros
    $sqlPomo = "SELECT SUM(
                    CASE 
                        WHEN activity_details LIKE '%duration%'
                        THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(activity_details, '$.duration')) AS DECIMAL) * 60 
                        ELSE 25 * 60 
                    END
                ) as total 
                FROM activity_log 
                WHERE activity_type = 'pomodoro_session' 
                AND timestamp BETWEEN ? AND ?
                AND (activity_details LIKE '%\"status\":\"completed\"%' OR activity_details IS NULL OR activity_details = '')";
    $stmtPomo = $conn->prepare($sqlPomo);
    $stmtPomo->bind_param("ss", $startTs, $endTs);
    $stmtPomo->execute();
    if ($row = $stmtPomo->get_result()->fetch_assoc()) {
        $totalSeconds += intval($row['total']);
    }

    // C. Add Current Progress if session is active
    $sqlActive = "SELECT 
                    CASE 
                        WHEN status = 'active' THEN (duration_minutes * 60 - remaining_seconds) + (UNIX_TIMESTAMP(NOW()) - UNIX_TIMESTAMP(last_heartbeat))
                        ELSE (duration_minutes * 60 - remaining_seconds)
                    END as active_seconds
                FROM study_sessions
                WHERE (status = 'active' OR status = 'paused') AND session_type = 'focus'
                LIMIT 1";
    if ($row = $conn->query($sqlActive)->fetch_assoc()) {
        $totalSeconds += max(0, intval($row['active_seconds']));
    }

    // 4. Count Exams Taken Today
    $sqlExamCount = "SELECT COUNT(*) as total FROM performance WHERE attempt_time BETWEEN ? AND ?";
    $stmtEC = $conn->prepare($sqlExamCount);
    $stmtEC->bind_param("ss", $startTs, $endTs);
    $stmtEC->execute();
    $examsDone = $stmtEC->get_result()->fetch_assoc()['total'];

    // 5. Calculate Goal Progress (Benchmark: 12 Hours = 43200 seconds)
    $goalSeconds = 12 * 3600;
    $percent = min(100, round(($totalSeconds / $goalSeconds) * 100));

    // Visual Progress Bar
    $barLength = 10;
    $filledLength = round($percent / 10);
    $bar = str_repeat("🟢", $filledLength) . str_repeat("⚪", $barLength - $filledLength);

    // Formatting Time
    $hours = floor($totalSeconds / 3600);
    $mins = floor(($totalSeconds % 3600) / 60);
    $timeStr = "{$hours}h {$mins}m";

    // 6. Build Message
    $report = "📊 *Today's Progress Report*\n";
    $report .= "Date: _" . date('d M, Y') . "_\n\n";

    $report .= "🔥 *Streak:* {$streak} Days\n";
    $report .= "⏱ *Focus Time:* {$timeStr}\n";
    $report .= "🏁 *Daily Goal:* {$percent}%\n";
    $report .= "`{$bar}`\n\n";

    $report .= "📝 *Exams Completed:* {$examsDone}\n\n";

    if ($percent >= 100) {
        $report .= "🏆 *GENIUS STATUS:* Goal accomplished! You are unstoppable.";
    } elseif ($percent >= 50) {
        $report .= "⚡ *ON TRACK:* Great momentum. Keep pushing to 100%!";
    } else {
        $report .= "🔋 *GET STARTED:* The night is young. Time to lock in.";
    }

    sendTgMessage($token, $chatId, $report);
}

/**
 * Handle callback button taps
 */
function handleCallback($conn, $token, $chatId, $cb)
{
    $data = $cb['data'];

    if (strpos($data, 'start_') === 0) {
        $subject_id = str_replace('start_', '', $data);

        // 1. Get subject name
        $stmt = $conn->prepare("SELECT subject_name FROM subjects WHERE id = ?");
        $stmt->bind_param("i", $subject_id);
        $stmt->execute();
        $res = $stmt->get_result();
        $subject = $res->fetch_assoc();

        if (!$subject) {
            answerCallback($token, $cb['id'], "Subject not found.");
            return;
        }

        $subjectName = $subject['subject_name'];

        // 2. Check for active pomodoro (User's specific request)
        $checkRes = $conn->query("SELECT subject_name FROM study_sessions WHERE status IN ('active', 'paused') LIMIT 1");
        if ($activeRow = $checkRes->fetch_assoc()) {
            // Already a session running
            $keyboard = [
                'inline_keyboard' => [
                    [
                        ['text' => "✅ Yes, stop and start NEW", 'callback_data' => "confirm_start_" . $subject_id],
                        ['text' => "❌ No, keep current", 'callback_data' => "cancel"]
                    ]
                ]
            ];

            sendTgMessage($token, $chatId, "⚠️ *Conflict!*\nAn active session for *{$activeRow['subject_name']}* is already in progress.\nStart *{$subjectName}* anyway?", $keyboard);
            answerCallback($token, $cb['id']);
            return;
        }

        // 3. No conflict, start session
        startPomodoroSession($conn, $token, $chatId, $subject_id, $subjectName);
        answerCallback($token, $cb['id'], "Session started!");

    } elseif (strpos($data, 'confirm_start_') === 0) {
        $subject_id = str_replace('confirm_start_', '', $data);
        $stmt = $conn->prepare("SELECT subject_name FROM subjects WHERE id = ?");
        $stmt->bind_param("i", $subject_id);
        $stmt->execute();
        $res = $stmt->get_result();
        $subject = $res->fetch_assoc();

        if ($subject) {
            startPomodoroSession($conn, $token, $chatId, $subject_id, $subject['subject_name']);
            answerCallback($token, $cb['id'], "Session started!");
        }
    } elseif ($data === 'repeat_last') {
        handleRestartLastCommand($conn, $token, $chatId);
        answerCallback($token, $cb['id']);
    } elseif ($data === 'start_break') {
        handleBreakCommand($conn, $token, $chatId);
        answerCallback($token, $cb['id']);
    } elseif ($data === 'start_study_menu') {
        handleStudyCommand($conn, $token, $chatId);
        answerCallback($token, $cb['id']);
    } elseif ($data === 'nudge_5m') {
        global $lastNudgeTime, $nudgeInterval, $isNagMode;
        $lastNudgeTime = time();
        $nudgeInterval = 300;
        $isNagMode = false;
        sendTgMessage($token, $chatId, "⏳ *Postponed.* I'll check on you in 5 minutes.");
        answerCallback($token, $cb['id']);
    } elseif ($data === 'nudge_stop') {
        global $nudgeActive;
        $nudgeActive = false;
        sendTgMessage($token, $chatId, "🛑 *Nudges Disabled.* Tap /study whenever you're ready to lock in.");
        answerCallback($token, $cb['id']);
    } elseif ($data === 'cancel') {
        sendTgMessage($token, $chatId, "🆗 *Action cancelled.*");
        answerCallback($token, $cb['id']);
    }
}

/**
 * Core logic to start a session in the DB
 */
function startPomodoroSession($conn, $token, $chatId, $subjectId, $subjectName)
{
    // Abandon previous
    $conn->query("UPDATE study_sessions SET status = 'abandoned' WHERE status IN ('active', 'paused')");

    // Insert new
    $duration = 25; // Default 25 min
    $seconds = $duration * 60;
    $stmt = $conn->prepare("INSERT INTO study_sessions (subject_id, subject_name, duration_minutes, remaining_seconds, status, start_time, last_heartbeat, session_type) VALUES (?, ?, ?, ?, 'active', NOW(), NOW(), 'focus')");
    $stmt->bind_param("isii", $subjectId, $subjectName, $duration, $seconds);

    if ($stmt->execute()) {
        sendTgMessage($token, $chatId, "🚀 *Pomodoro Started!*\n📖 Subject: *{$subjectName}*\n⏳ Duration: 25 min\n\nYour dashboard will sync automatically.");
    } else {
        sendTgMessage($token, $chatId, "❌ *Error starting session:* " . $conn->error);
    }
}

/**
 * Get the persistent main menu keyboard
 */
function getMainMenu()
{
    return [
        'keyboard' => [
            [['text' => "📚 Start Study"], ['text' => "🛑 Stop Session"]],
            [['text' => "⏸ Pause"], ['text' => "▶️ Resume"]],
            [['text' => "🔄 Restart Last"], ['text' => "☕ Start Break"]],
            [['text' => "⏱ Status"], ['text' => "📊 Progress Report"]]
        ],
        'resize_keyboard' => true,
        'one_time_keyboard' => false
    ];
}

/**
 * Curated Motivational Messages
 */
function getRandomMotivation()
{
    $quotes = [
        "The pain of discipline is far less than the pain of regret.",
        "Your future self is either thanking you or blaming you right now.",
        "Focus is the new IQ. Lock in and stay consistent.",
        "Success is what happens after you survive all your mistakes.",
        "Don't stop when you're tired. Stop when you're DONE.",
        "A year from now, you’ll wish you had started today.",
        "The best way to predict your future is to create it.",
        "Every focused minute counts towards your legacy.",
        "Small steps every day lead to big results.",
        "Results require action. Ideas are just the start."
    ];
    return $quotes[array_rand($quotes)];
}
