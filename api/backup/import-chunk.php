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

// ─── Fresh-Machine Bootstrap ─────────────────────────────────────────────────
$_bhost = 'localhost';
$_buser = 'root';
$_bpass = '';
$_bname = 'admin_examtaking';

$_boot = @new mysqli($_bhost, $_buser, $_bpass);
if (!$_boot->connect_error) {
    $_boot->query(
        "CREATE DATABASE IF NOT EXISTS `{$_bname}`
         CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
    );
    $_boot->close();
}
unset($_boot, $_bhost, $_buser, $_bpass, $_bname);

require_once '../subject/db_connect.php';

// ─── Allowed Tables (whitelist) ──────────────────────────────────────────────

$ALLOWED_TABLES = [
    'subjects', 'lessons', 'topics', 'exams', 'questions',
    'performance', 'question_attempts', 'question_srs',
    'offline_exam_attempts', 'study_sessions', 'activity_log',
    'mistake_bank', 'flashcards', 'reading_logs', 'user_streaks',
    'job_countdown', 'trivia_snapshots',
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

    foreach ($schemas as $table => $ddl) {
        if (empty($ddl)) continue;

        $safe_ddl = preg_replace(
            '/^CREATE TABLE\s+`/i',
            'CREATE TABLE IF NOT EXISTS `',
            $ddl
        );

        if ($conn->query($safe_ddl)) {
            $created[] = $table;
        } else {
            $errors[] = "[{$table}] " . $conn->error;
        }
    }

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

    $conn->query("SET FOREIGN_KEY_CHECKS = 0");
    $conn->begin_transaction();

    $inserted = 0;
    $skipped  = 0;
    $errors   = [];

    try {
        foreach ($rows as $row) {
            if (empty($row) || !is_array($row)) continue;

            try {
                [$sql, $types, $values] = build_upsert_chunk($conn, $table, $row, $overwrite);

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
