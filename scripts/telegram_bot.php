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
    if ($row['setting_key'] === 'telegram_bot_token') $tgToken = $row['setting_value'];
    if ($row['setting_key'] === 'telegram_chat_id') $tgChatId = $row['setting_value'];
}

if (!$tgToken || !$tgChatId) {
    die("ERROR: Telegram credentials not found in app_settings. Run setup_telegram.php first.\n");
}

echo "--- Pomodoro Telegram Bot Started ---\n";
echo "Bot Token: " . substr($tgToken, 0, 10) . "...\n";
echo "Watching Chat ID: $tgChatId\n";
echo "Press Ctrl+C to stop.\n\n";

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
                if ($chatId != $tgChatId) continue;
                
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
                } elseif (strpos($text, '/start') === 0) {
                    sendTgMessage($tgToken, $chatId, "👋 *Welcome to Rethink Pomodoro!*\nUse the keyboard below to control your study sessions.");
                }
            }
            
            // 2. Handle Callback Queries (Button Taps)
            if (isset($update['callback_query'])) {
                $cb = $update['callback_query'];
                $chatId = $cb['message']['chat']['id'];
                if ($chatId != $tgChatId) continue;
                
                handleCallback($conn, $tgToken, $chatId, $cb);
            }
        }
    }
    
    usleep(500000); // Poll every 500ms
}

/**
 * Fetch updates from Telegram
 */
function getTelegramUpdates($token, $offset) {
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
function sendTgMessage($token, $chatId, $text, $keyboard = null) {
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
function answerCallback($token, $callbackId, $text = "") {
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
function handleStudyCommand($conn, $token, $chatId) {
    $sql = "SELECT id, subject_name FROM subjects WHERE is_deleted = 0 ORDER BY subject_name ASC";
    $result = $conn->query($sql);
    
    if ($result->num_rows === 0) {
        sendTgMessage($token, $chatId, "❌ No subjects found. Please add subjects first.");
        return;
    }
    
    $buttons = [];
    while ($row = $result->fetch_assoc()) {
        $buttons[] = [[
            'text' => $row['subject_name'],
            'callback_data' => "start_" . $row['id']
        ]];
    }
    
    $keyboard = ['inline_keyboard' => $buttons];
    sendTgMessage($token, $chatId, "📚 *Select a subject to start studying:*", $keyboard);
}

/**
 * Handle /stop command
 */
function handleStopCommand($conn, $token, $chatId) {
    $conn->query("UPDATE study_sessions SET status = 'abandoned' WHERE status IN ('active', 'paused')");
    sendTgMessage($token, $chatId, "🛑 *Session stopped.*");
}

/**
 * Handle /pause command
 */
function handlePauseCommand($conn, $token, $chatId) {
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
function handleResumeCommand($conn, $token, $chatId) {
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
function handleRestartLastCommand($conn, $token, $chatId) {
    $res = $conn->query("SELECT subject_id, subject_name FROM study_sessions 
                         WHERE session_type = 'focus' AND subject_id IS NOT NULL 
                         ORDER BY id DESC LIMIT 1");
    
    if ($row = $res->fetch_assoc()) {
        $subjectId = $row['subject_id'];
        $subjectName = $row['subject_name'];
        
        // Safety check for active session
        $checkRes = $conn->query("SELECT subject_name FROM study_sessions WHERE status IN ('active', 'paused') LIMIT 1");
        if ($activeRow = $checkRes->fetch_assoc()) {
            $keyboard = ['inline_keyboard' => [[
                ['text' => "✅ Yes, restart", 'callback_data' => "confirm_start_" . $subjectId],
                ['text' => "❌ No", 'callback_data' => "cancel"]
            ]]];
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
function handleBreakCommand($conn, $token, $chatId) {
    // Abandon previous
    $conn->query("UPDATE study_sessions SET status = 'abandoned' WHERE status IN ('active', 'paused')");
    
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
function handleStatusCommand($conn, $token, $chatId) {
    // For active sessions, calculate ground-truth remaining time using start_time.
    // For paused sessions, use the stored remaining_seconds.
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
            if ($realRemaining < 0) $realRemaining = 0;
        } else {
            $realRemaining = $row['remaining_seconds'];
        }

        $remain = floor($realRemaining / 60) . "m " . ($realRemaining % 60) . "s";
        sendTgMessage($token, $chatId, "⏱ *Current Session:*\n📖 Subject: *{$row['subject_name']}*\n🔄 Status: {$status}\n⏳ Time Left: {$remain}");
    } else {
        sendTgMessage($token, $chatId, "🔌 *No active session.* Use /study to start one.");
    }
}

/**
 * Handle callback button taps
 */
function handleCallback($conn, $token, $chatId, $cb) {
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
            $keyboard = ['inline_keyboard' => [[
                ['text' => "✅ Yes, stop and start NEW", 'callback_data' => "confirm_start_" . $subject_id],
                ['text' => "❌ No, keep current", 'callback_data' => "cancel"]
            ]]];
            
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
    } elseif ($data === 'cancel') {
        sendTgMessage($token, $chatId, "🆗 *Action cancelled.*");
        answerCallback($token, $cb['id']);
    }
}

/**
 * Core logic to start a session in the DB
 */
function startPomodoroSession($conn, $token, $chatId, $subjectId, $subjectName) {
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
function getMainMenu() {
    return [
        'keyboard' => [
            [['text' => "📚 Start Study"], ['text' => "🛑 Stop Session"]],
            [['text' => "⏸ Pause"], ['text' => "▶️ Resume"]],
            [['text' => "🔄 Restart Last"], ['text' => "☕ Start Break"]],
            [['text' => "⏱ Status"]]
        ],
        'resize_keyboard' => true,
        'one_time_keyboard' => false
    ];
}
