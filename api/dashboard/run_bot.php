<?php
/**
 * API Endpoint: Start, Stop, and Check Status of the Telegram Bot
 * Called from the Smart Header bot icon button.
 * 
 * Usage:
 *   ?action=start   - Launch run_bot.bat in background
 *   ?action=stop    - Kill the bot process
 *   ?action=status  - Check if bot is currently running
 */
header('Content-Type: application/json');

// CLI detection for localhost safety
$host = (php_sapi_name() === 'cli') ? 'localhost' : ($_SERVER['HTTP_HOST'] ?? 'localhost');

// Only allow from localhost or local network (192.168.*)
$remoteAddr = $_SERVER['REMOTE_ADDR'] ?? '';
$isLocalNetwork = preg_match('/^192\.168\.|^10\.|^172\.(1[6-9]|2[0-9]|3[0-1])\./', $remoteAddr);
$isLocalhost = in_array($remoteAddr, ['127.0.0.1', '::1']);

if (!$isLocalhost && !$isLocalNetwork && php_sapi_name() !== 'cli') {
    echo json_encode(['success' => false, 'message' => 'Blocked: Outside local network']);
    exit;
}

$action = $_GET['action'] ?? 'start';
$batPath = realpath(__DIR__ . '/../../run_bot.bat');
$projectDir = realpath(__DIR__ . '/../../');
$scriptName = 'telegram_bot.php';

/**
 * Check if the bot process is running
 */
function isBotRunning($scriptName) {
    $output = [];
    exec('tasklist /FI "IMAGENAME eq php.exe" /FO CSV /NH 2>&1', $output);
    
    // Also check via wmic for command line containing our script
    $wmicOutput = [];
    exec('wmic process where "name=\'php.exe\'" get commandline /format:csv 2>&1', $wmicOutput);
    
    foreach ($wmicOutput as $line) {
        if (stripos($line, $scriptName) !== false) {
            return true;
        }
    }
    return false;
}

switch ($action) {
    case 'status':
        $running = isBotRunning($scriptName);
        echo json_encode([
            'success' => true,
            'running' => $running
        ]);
        break;

    case 'stop':
        // Kill all php processes running telegram_bot.php
        $wmicOutput = [];
        exec('wmic process where "name=\'php.exe\'" get processid,commandline /format:csv 2>&1', $wmicOutput);
        
        $killed = 0;
        foreach ($wmicOutput as $line) {
            if (stripos($line, $scriptName) !== false) {
                // Extract PID (last CSV field)
                $parts = explode(',', trim($line));
                $pid = end($parts);
                if (is_numeric($pid)) {
                    exec("taskkill /PID $pid /F 2>&1");
                    $killed++;
                }
            }
        }
        
        // Also kill any cmd.exe running our bat file
        $cmdOutput = [];
        exec('wmic process where "name=\'cmd.exe\'" get processid,commandline /format:csv 2>&1', $cmdOutput);
        foreach ($cmdOutput as $line) {
            if (stripos($line, 'run_bot.bat') !== false) {
                $parts = explode(',', trim($line));
                $pid = end($parts);
                if (is_numeric($pid)) {
                    exec("taskkill /PID $pid /F 2>&1");
                    $killed++;
                }
            }
        }

        echo json_encode([
            'success' => true,
            'message' => $killed > 0 ? "Stopped $killed process(es)" : 'No bot process found',
            'killed' => $killed
        ]);
        break;

    case 'start':
    default:
        // Check if already running
        if (isBotRunning($scriptName)) {
            echo json_encode([
                'success' => true,
                'message' => 'Bot is already running',
                'already_running' => true
            ]);
            break;
        }

        if (!$batPath || !file_exists($batPath)) {
            echo json_encode(['success' => false, 'message' => 'run_bot.bat not found']);
            break;
        }

        // Write a temp VBS launcher that sets working directory to project root
        $vbsFile = sys_get_temp_dir() . '\\rethink_bot_launcher.vbs';
        $vbsContent  = 'Set ws = CreateObject("WScript.Shell")' . "\r\n";
        $vbsContent .= 'ws.CurrentDirectory = "' . $projectDir . '"' . "\r\n";
        $vbsContent .= 'ws.Run chr(34) & "' . $batPath . '" & chr(34), 0, False' . "\r\n";
        file_put_contents($vbsFile, $vbsContent);

        // Execute the VBS (non-blocking, hidden window)
        pclose(popen('start /B cscript //nologo "' . $vbsFile . '"', 'r'));

        echo json_encode([
            'success' => true,
            'message' => 'Bot launched successfully',
            'path' => $batPath
        ]);
        break;
}
