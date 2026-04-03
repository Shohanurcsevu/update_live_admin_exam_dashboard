<?php
/**
 * Chunked Import API — v2.0
 * Imports data table-by-table to avoid memory/timeout issues.
 *
 * POST ?action=schema           → body: { "schema": { "table": "DDL", ... } }
 * POST ?action=data&table=NAME&conflict=skip|overwrite  → body: { "rows": [...] }
 */

set_time_limit(120);
ini_set('memory_limit', '64M');

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Only POST requests are accepted.']);
    exit;
}

// --- ENVIRONMENT DETECTION ---
// Detects localhost, 127.0.0.1, or local network IPs (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
$host = $_SERVER['HTTP_HOST'] ?? '';
$is_localhost = (
    in_array($_SERVER['REMOTE_ADDR'] ?? '', ['127.0.0.1', '::1']) || 
    $host === 'localhost' || 
    preg_match('/^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/', $host)
);

if ($is_localhost) {
    // Fresh-Machine Bootstrap: Only run this on localhost. 
    // Uses standard XAMPP credentials (root, no pass)
    $_boot = @new mysqli('localhost', 'root', '');
    if (!$_boot->connect_error) {
        $_boot->query(
            "CREATE DATABASE IF NOT EXISTS `admin_examtaking`
             CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
        );
        $_boot->close();
    }
    unset($_boot);
}

require_once '../subject/db_connect.php';

// ─── Allowed Tables (whitelist) ──────────────────────────────────────────────

$ALLOWED_TABLES = [
    'subjects', 'lessons', 'topics', 'exams', 'questions',
    'performance', 'question_attempts', 'question_srs',
    'offline_exam_attempts', 'study_sessions', 'activity_log',
    'mistake_bank', 'flashcards', 'reading_logs', 'user_streaks',
    'job_countdown', 'trivia_snapshots', 'bpm_logs', 'app_settings',
    'active_exam_sessions', 'ai_instruction_presets', 'ai_prompt_presets', 'exam_presets', 'exam_setup_presets',
    'ai_usage_log', 'todays_exams_list',
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

function sync_table_columns(mysqli $conn, string $table, string $ddl) {
    // Extract column definitions from DDL (lines starting with `...`)
    preg_match_all('/^\s*`([^`]+)`\s+([^,]+)/m', $ddl, $matches);
    if (empty($matches[1])) return;
    
    $ddl_cols = array_combine($matches[1], $matches[2]);

    // Current columns in DB
    $res = $conn->query("SHOW COLUMNS FROM `{$table}`");
    $db_cols = [];
    if ($res) {
        while ($c = $res->fetch_assoc()) $db_cols[] = $c['Field'];
        $res->free();
    }

    foreach ($ddl_cols as $col => $def) {
        if (!in_array($col, $db_cols)) {
            // Clean up definition (remove trailing commas if any, though regex handle it)
            $clean_def = rtrim(trim($def), ',');
            $conn->query("ALTER TABLE `{$table}` ADD COLUMN `{$col}` {$clean_def}");
        }
    }
}

function build_upsert_chunk(mysqli $conn, string $table, array $row, bool $overwrite): array {
    if (empty($row)) throw new InvalidArgumentException("Empty row for table $table");

    $columns = array_keys($row);
    $colList  = implode(', ', array_map(fn($c) => "`{$c}`", $columns));
    $placeholders = implode(', ', array_fill(0, count($columns), '?'));
    $verb = $overwrite ? 'REPLACE' : 'INSERT IGNORE';

    $sql    = "{$verb} INTO `{$table}` ({$colList}) VALUES ({$placeholders})";
    $types  = '';
    $values = [];

    foreach ($row as $val) {
        if (is_null($val))              { $types .= 's'; $values[] = null; }
        elseif (is_int($val))           { $types .= 'i'; $values[] = $val; }
        elseif (is_float($val))         { $types .= 'd'; $values[] = $val; }
        else                            { $types .= 's'; $values[] = (string)$val; }
    }

    return [$sql, $types, $values];
}

// ─── Read JSON body ──────────────────────────────────────────────────────────

$raw = file_get_contents('php://input');
if (!$raw) respond_error('Empty request body.');

$body = json_decode($raw, true);
if (json_last_error() !== JSON_ERROR_NONE) {
    respond_error('Invalid JSON body: ' . json_last_error_msg());
}

// ─── Route ───────────────────────────────────────────────────────────────────

$action = $_GET['action'] ?? '';

if ($action === 'schema') {
    // ── Create tables from schema DDL ─────────────────────────────────────────
    $schemas = $body['schema'] ?? [];
    if (empty($schemas) || !is_array($schemas)) {
        respond_error('Missing or invalid "schema" field.');
    }

    $created = [];
    $errors  = [];

    $conn->query("SET FOREIGN_KEY_CHECKS = 0");

    foreach ($schemas as $table => $ddl) {
        if (empty($ddl)) continue;

        // 1. Ensure table exists
        $safe_ddl = preg_replace('/^CREATE TABLE\s+`/i', 'CREATE TABLE IF NOT EXISTS `', $ddl);
        if ($conn->query($safe_ddl)) {
            $created[] = $table;
            
            // 2. Synchronize columns if table already existed 
            // (CREATE TABLE IF NOT EXISTS doesn't add missing columns)
            sync_table_columns($conn, $table, $ddl);
        } else {
            $errors[] = "[{$table}] " . $conn->error;
        }
    }

    $conn->query("SET FOREIGN_KEY_CHECKS = 1");

    $conn->close();
    respond_json([
        'success' => empty($errors),
        'created' => $created,
        'errors'  => $errors,
    ]);

} elseif ($action === 'data') {
    // ── Import rows for one table ─────────────────────────────────────────────
    $table = $_GET['table'] ?? '';
    $conflict = ($_GET['conflict'] ?? 'skip') === 'overwrite' ? 'overwrite' : 'skip';
    $overwrite = ($conflict === 'overwrite');

    if (!in_array($table, $ALLOWED_TABLES, true)) {
        $conn->close();
        respond_error("Invalid table name: {$table}");
    }

    $rows = $body['rows'] ?? [];
    if (!is_array($rows)) {
        $conn->close();
        respond_error('Missing or invalid "rows" field.');
    }

    // Fetch available columns in the target table to handle schema mismatches
    $target_cols = [];
    $res = $conn->query("SHOW COLUMNS FROM `{$table}`");
    if ($res) {
        while ($c = $res->fetch_assoc()) $target_cols[] = $c['Field'];
        $res->free();
    }

    $conn->query("SET FOREIGN_KEY_CHECKS = 0");
    $conn->begin_transaction();

    $inserted = 0;
    $skipped  = 0;
    $errors   = [];

    try {
        foreach ($rows as $row) {
            if (empty($row) || !is_array($row)) continue;

            // Handle schema mismatches: Add missing columns dynamically
            $missing_cols = array_diff(array_keys($row), $target_cols);
            if (!empty($missing_cols)) {
                foreach ($missing_cols as $new_col) {
                    $val = $row[$new_col];
                    $type = 'LONGTEXT'; // Safe default for strings/complex data
                    if (is_int($val))       $type = 'INT(11)';
                    elseif (is_float($val)) $type = 'DECIMAL(15,2)';
                    elseif (is_bool($val))  $type = 'TINYINT(1)';
                    
                    // Attempt to add the column so data isn't lost
                    if ($conn->query("ALTER TABLE `{$table}` ADD COLUMN `{$new_col}` {$type} NULL")) {
                        $target_cols[] = $new_col;
                    }
                }
            }

            // Filter row to only include columns that exist in the target table
            $filtered_row = array_intersect_key($row, array_flip($target_cols));

            if (empty($filtered_row)) {
                $skipped++;
                continue;
            }

            try {
                [$sql, $types, $values] = build_upsert_chunk($conn, $table, $filtered_row, $overwrite);

                $stmt = $conn->prepare($sql);
                if (!$stmt) throw new RuntimeException("Prepare failed: " . $conn->error);

                if (!empty($values)) {
                    $refs = [];
                    foreach ($values as &$v) $refs[] = &$v;
                    $stmt->bind_param($types, ...$refs);
                }

                $stmt->execute();
                $affected = $stmt->affected_rows;
                $stmt->close();

                if ($affected > 0) {
                    $inserted++;
                } else {
                    $skipped++;
                }
            } catch (Exception $rowEx) {
                $errors[] = $rowEx->getMessage();
            }
        }

        $conn->commit();
    } catch (Exception $e) {
        $conn->rollback();
        $conn->query("SET FOREIGN_KEY_CHECKS = 1");
        $conn->close();
        respond_json([
            'success'  => false,
            'table'    => $table,
            'error'    => $e->getMessage(),
            'inserted' => $inserted,
            'skipped'  => $skipped,
            'errors'   => $errors,
        ]);
    }

    $conn->query("SET FOREIGN_KEY_CHECKS = 1");
    $conn->close();

    respond_json([
        'success'  => true,
        'table'    => $table,
        'inserted' => $inserted,
        'skipped'  => $skipped,
        'errors'   => $errors,
    ]);

} else {
    $conn->close();
    respond_error('Missing or invalid action. Use ?action=schema or ?action=data&table=NAME&conflict=skip');
}
