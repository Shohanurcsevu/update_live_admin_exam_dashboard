<?php
/**
 * Auto-Backup API — v1.0
 * Returns the full database export as raw JSON (no Content-Disposition header).
 * Used by the browser-side auto-backup manager to fetch data and write it
 * silently to a user-chosen cloud-synced folder (File System Access API).
 *
 * GET /api/backup/auto-backup.php
 */

set_time_limit(300);
ini_set('memory_limit', '256M');

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-store, no-cache, must-revalidate');

require_once '../subject/db_connect.php';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ab_fetch_table(mysqli $conn, string $table): array {
    $result = $conn->query("SELECT * FROM `{$table}`");
    if (!$result) return [];
    $rows = [];
    while ($row = $result->fetch_assoc()) {
        $rows[] = $row;
    }
    $result->free();
    return $rows;
}

function ab_fetch_create_table(mysqli $conn, string $table): string {
    $result = $conn->query("SHOW CREATE TABLE `{$table}`");
    if (!$result) return '';
    $row = $result->fetch_row();
    $result->free();
    return $row[1] ?? '';
}

// ─── Build Export Object ─────────────────────────────────────────────────────

$tables = [
    'subjects', 'lessons', 'topics', 'exams', 'questions',
    'performance', 'question_attempts', 'question_srs',
    'offline_exam_attempts', 'study_sessions', 'activity_log',
    'mistake_bank', 'flashcards', 'reading_logs', 'user_streaks',
    'job_countdown', 'trivia_snapshots', 'bpm_logs',
    'active_exam_sessions', 'ai_instruction_presets', 'app_settings',
    'exam_presets', 'exam_setup_presets',
];

$backup = [
    'backup_version' => '1.1',
    'app'            => 'rethink-admin',
    'exported_at'    => date('c'),
    'backup_type'    => 'auto',          // distinguishes from manual export
    'db_name'        => DB_NAME,
    'db_charset'     => 'utf8mb4',
    'db_collation'   => 'utf8mb4_unicode_ci',
    'table_counts'   => [],
    'schema'         => [],
    'data'           => [],
];

$total_records = 0;

foreach ($tables as $table) {
    $backup['schema'][$table]      = ab_fetch_create_table($conn, $table);
    $rows                          = ab_fetch_table($conn, $table);
    $backup['data'][$table]        = $rows;
    $backup['table_counts'][$table]= count($rows);
    $total_records                += count($rows);
}

$conn->close();

// ─── Compress & Emit (no download header — browser JS handles file writing) ──

$json    = json_encode($backup, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
$gzipped = gzencode($json, 6);

header('Content-Type: application/gzip');
header('Content-Length: ' . strlen($gzipped));
header('X-Backup-Version: 1.1');
header('X-Backup-Tables: ' . count($tables));
header('X-Backup-Records: ' . $total_records);
header('X-Backup-Type: auto');

echo $gzipped;
exit;
