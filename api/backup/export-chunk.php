<?php
/**
 * Chunked Export API — v2.0
 * Exports data table-by-table to avoid memory/timeout issues.
 *
 * GET ?action=meta              → schema DDL, row counts, backup metadata
 * GET ?action=data&table=NAME   → rows for one table (gzipped JSON)
 */

set_time_limit(60);
ini_set('memory_limit', '64M');   // much less than the monolithic 256M

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

require_once '../subject/db_connect.php';

// ─── Allowed Tables (whitelist) ──────────────────────────────────────────────

$ALLOWED_TABLES = [
    'subjects', 'lessons', 'topics', 'exams', 'questions',
    'performance', 'question_attempts', 'question_srs',
    'offline_exam_attempts', 'study_sessions', 'activity_log',
    'mistake_bank', 'flashcards', 'reading_logs', 'user_streaks',
    'job_countdown', 'trivia_snapshots', 'app_settings', 'bpm_logs',
    'active_exam_sessions', 'ai_instruction_presets', 'ai_prompt_presets', 'exam_presets', 'exam_setup_presets',
    'ai_usage_log', 'todays_exams_list',
    'streak_activity_log', 'study_pacts',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function respond_json($data) {
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function respond_error(string $msg, int $code = 400) {
    http_response_code($code);
    respond_json(['error' => $msg]);
}

// ─── Route ───────────────────────────────────────────────────────────────────

$action = $_GET['action'] ?? '';

if ($action === 'meta') {
    // ── Return schema + row counts (no data) ──────────────────────────────────
    $schema = [];
    $table_counts = [];
    $total_records = 0;

    foreach ($ALLOWED_TABLES as $table) {
        // Schema DDL
        $r = $conn->query("SHOW CREATE TABLE `{$table}`");
        $schema[$table] = ($r && ($row = $r->fetch_row())) ? ($row[1] ?? '') : '';
        if ($r) $r->free();

        // Row count
        $r = $conn->query("SELECT COUNT(*) AS cnt FROM `{$table}`");
        $cnt = ($r && ($row = $r->fetch_assoc())) ? (int)$row['cnt'] : 0;
        $table_counts[$table] = $cnt;
        $total_records += $cnt;
        if ($r) $r->free();
    }

    $conn->close();

    respond_json([
        'backup_version' => '2.0',
        'app'            => 'rethink-admin',
        'exported_at'    => date('c'),
        'db_name'        => DB_NAME,
        'db_charset'     => 'utf8mb4',
        'db_collation'   => 'utf8mb4_unicode_ci',
        'tables'         => $ALLOWED_TABLES,
        'schema'         => $schema,
        'table_counts'   => $table_counts,
        'total_records'  => $total_records,
    ]);

} elseif ($action === 'data') {
    // ── Return rows for one table ─────────────────────────────────────────────
    $table = $_GET['table'] ?? '';

    if (!in_array($table, $ALLOWED_TABLES, true)) {
        $conn->close();
        respond_error("Invalid table name: {$table}");
    }

    $result = $conn->query("SELECT * FROM `{$table}`");
    $rows = [];
    if ($result) {
        while ($row = $result->fetch_assoc()) {
            $rows[] = $row;
        }
        $result->free();
    }

    $conn->close();

    respond_json(['table' => $table, 'count' => count($rows), 'rows' => $rows]);

} else {
    $conn->close();
    respond_error('Missing or invalid action. Use ?action=meta or ?action=data&table=NAME');
}
