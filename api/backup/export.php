<?php
/**
 * Backup Export API — v1.1
 * Exports all application data AND schema as a single versioned JSON file.
 * On import, the schema enables full fresh-machine setup (CREATE TABLE IF NOT EXISTS).
 * GET /api/backup/export.php
 */

set_time_limit(300);
ini_set('memory_limit', '256M');

require_once '../subject/db_connect.php';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fetch_table(mysqli $conn, string $table): array {
    $result = $conn->query("SELECT * FROM `{$table}`");
    if (!$result) return [];
    $rows = [];
    while ($row = $result->fetch_assoc()) {
        $rows[] = $row;
    }
    $result->free();
    return $rows;
}

function fetch_create_table(mysqli $conn, string $table): string {
    $result = $conn->query("SHOW CREATE TABLE `{$table}`");
    if (!$result) return '';
    $row = $result->fetch_row();
    $result->free();
    return $row[1] ?? '';   // "CREATE TABLE `name` ( ... ) ENGINE=..."
}

// ─── Build Export Object ─────────────────────────────────────────────────────

$backup = [
    'backup_version' => '1.1',          // bumped: now includes schema
    'app'            => 'rethink-admin',
    'exported_at'    => date('c'),
    'db_name'        => DB_NAME,
    'db_charset'     => 'utf8mb4',
    'db_collation'   => 'utf8mb4_unicode_ci',
    'table_counts'   => [],
    'schema'         => [],             // CREATE TABLE statements
    'data'           => [],
];

$tables = [
    'subjects',
    'lessons',
    'topics',
    'exams',
    'questions',
    'performance',
    'question_attempts',
    'question_srs',
    'offline_exam_attempts',
    'study_sessions',
    'activity_log',
    'mistake_bank',
    'flashcards',
    'reading_logs',
    'user_streaks',
    'job_countdown',
    'trivia_snapshots',
    'app_settings',
    'bpm_logs',
    'active_exam_sessions',
    'ai_instruction_presets',
    'ai_prompt_presets',
    'exam_presets',
    'exam_setup_presets',
    'ai_usage_log',
    'todays_exams_list',
];

foreach ($tables as $table) {
    // Capture CREATE TABLE DDL
    $ddl = fetch_create_table($conn, $table);
    $backup['schema'][$table] = $ddl;

    // Capture rows
    $rows = fetch_table($conn, $table);
    $backup['data'][$table]         = $rows;
    $backup['table_counts'][$table] = count($rows);
}

$conn->close();

// ─── Compress & Stream as Download ────────────────────────────────────────────

$json     = json_encode($backup, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
$gzipped  = gzencode($json, 6);        // level 6 = good balance of speed vs size
$filename = 'rethink-backup-' . date('Y-m-d') . '.json.gz';

while (ob_get_level()) ob_end_clean();

header('Content-Type: application/gzip');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Content-Length: ' . strlen($gzipped));
header('Pragma: no-cache');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('X-Backup-Version: 1.1');
header('X-Backup-Tables: ' . count($tables));

echo $gzipped;
exit;

