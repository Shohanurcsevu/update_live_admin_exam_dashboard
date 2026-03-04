<?php
/**
 * Backup Diff API — Rethink Admin
 * Lists recent changes in activity_log since the last backup.
 * 
 * GET /api/backup/diff.php
 */

require_once '../subject/db_connect.php';

// Latest backup time from app_settings
$lastBackup = null;
$result = $conn->query("SELECT setting_value FROM app_settings WHERE setting_key = 'last_backup_time'");
if ($result) {
    $row = $result->fetch_assoc();
    if ($row && $row['setting_value']) $lastBackup = $row['setting_value'];
    $result->free();
}

$changes = [];
if ($lastBackup) {
    // Fetch activities that happened AFTER the last backup
    // Ignoring the same types we ignored in last-change.php
    $ignoredTypes = ["'backup_sync'", "'notification_sync'", "'search'", "'view'", "'challenge_issued'", "'pomodoro'"];
    $ignoredSql = implode(",", $ignoredTypes);
    
    $sql = "SELECT activity_type, activity_message, timestamp 
            FROM activity_log 
            WHERE timestamp > ? 
            AND activity_type NOT IN ($ignoredSql)
            ORDER BY timestamp DESC";
            
    $stmt = $conn->prepare($sql);
    $stmt->bind_param('s', $lastBackup);
    $stmt->execute();
    $res = $stmt->get_result();
    while ($row = $res->fetch_assoc()) {
        $changes[] = $row;
    }
    $stmt->close();
} else {
    // If no backup was ever done, list the most recent 20 activities
    $result = $conn->query("SELECT activity_type, activity_message, timestamp FROM activity_log ORDER BY timestamp DESC LIMIT 20");
    while ($row = $result->fetch_assoc()) {
        $changes[] = $row;
    }
}

$conn->close();

header('Content-Type: application/json; charset=utf-8');
echo json_encode([
    'success' => true,
    'last_backup' => $lastBackup,
    'changes' => $changes,
    'count' => count($changes)
]);
