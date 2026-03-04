<?php
/**
 * Last Change API — Cross-device backup awareness
 * Returns the latest data modification timestamp AND the last backup timestamp.
 * Both are stored server-side so ALL devices see the same state.
 * 
 * GET  /api/backup/last-change.php          → Get status
 * POST /api/backup/last-change.php          → Mark backup as done (sets last_backup_time to NOW)
 */

require_once '../subject/db_connect.php';

// Ensure app_settings table exists
$conn->query("CREATE TABLE IF NOT EXISTS app_settings (
    setting_key VARCHAR(50) PRIMARY KEY,
    setting_value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

// Set timezone to match db_connect.php +06:00
date_default_timezone_set('Asia/Dhaka');

// --- POST: Record that a backup was completed ---
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Use MySQL NOW() to stay consistent with activity_log timestamps
    $conn->query("INSERT INTO app_settings (setting_key, setting_value) VALUES ('last_backup_time', NOW())
                  ON DUPLICATE KEY UPDATE setting_value = NOW()");
    $conn->close();

    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => true]);
    exit;
}

// --- GET: Return last change vs last backup ---
$lastChange = null;
$lastBackup = null;

// Latest data modification (from activity_log)
// We ignore activity types that are just "logging", "syncing" or "automated" and don't need backing up
$ignoredTypes = ["'backup_sync'", "'notification_sync'", "'search'", "'view'", "'challenge_issued'", "'pomodoro'"];
$ignoredSql = implode(",", $ignoredTypes);

$result = $conn->query("SELECT MAX(timestamp) AS t FROM activity_log WHERE activity_type NOT IN ($ignoredSql)");
if ($result) {
    $row = $result->fetch_assoc();
    if ($row && $row['t']) $lastChange = $row['t'];
    $result->free();
}

// Latest backup time (from app_settings)
$result = $conn->query("SELECT setting_value FROM app_settings WHERE setting_key = 'last_backup_time'");
if ($result) {
    $row = $result->fetch_assoc();
    if ($row && $row['setting_value']) $lastBackup = $row['setting_value'];
    $result->free();
}

$conn->close();

$needsBackup = false;
if ($lastChange && $lastBackup) {
    $needsBackup = strtotime($lastChange) > strtotime($lastBackup);
} elseif ($lastChange && !$lastBackup) {
    $needsBackup = true; // Never backed up
}

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

echo json_encode([
    'success'            => true,
    'needs_backup'       => $needsBackup,
    'last_change'        => $lastChange,
    'last_change_unix'   => $lastChange ? strtotime($lastChange) : null,
    'last_backup'        => $lastBackup,
    'last_backup_unix'   => $lastBackup ? strtotime($lastBackup) : null,
]);
