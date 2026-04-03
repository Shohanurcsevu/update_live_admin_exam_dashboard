<?php
/**
 * Backup Import API — v1.1 aware
 * Accepts a previously exported backup JSON file and restores data.
 * On fresh machines, creates the database and all tables from backup schema.
 *
 * POST /api/backup/import.php?conflict=skip|overwrite
 *   multipart/form-data with field: backup (the JSON file)
 *
 * conflict=skip     → INSERT IGNORE  (safe, preserves existing data)
 * conflict=overwrite → REPLACE INTO  (overwrites matching IDs)
 */

// ─── Suppress PHP HTML errors (critical for fresh-machine imports) ───────────
// XAMPP has display_errors=On by default, which outputs <br /><b>Warning</b>
// HTML that corrupts JSON responses and causes "Unexpected token '<'" on client.
error_reporting(E_ALL);
ini_set('display_errors', '0');   // Never output errors as HTML
ini_set('log_errors', '1');       // Log them to php_error.log instead

set_time_limit(300);
ini_set('memory_limit', '256M');

// Start output buffering to catch ANY stray output before JSON
ob_start();

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    ob_end_clean();
    http_response_code(200);
    exit;
}

// --- ENVIRONMENT DETECTION ---
// Detects localhost, 127.0.0.1, or local network IPs (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
$host = $_SERVER['HTTP_HOST'] ?? '';
$is_localhost = (
    in_array($_SERVER['REMOTE_ADDR'] ?? '', ['127.0.0.1', '::1']) || 
    $host === 'localhost' || 
    strpos($host, 'localhost') !== false ||
    preg_match('/^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/', $host) ||
    strpos($host, '192.168.') === 0
);
// ─── Fresh-Machine Bootstrap ──────────────────────────────────────────────────
// Only run this on localhost. On live servers, we rely on CPanel/Manual DB creation.
if ($is_localhost) {
    // FRESH-MACHINE BOOTSTRAP: Automate DB creation on new local setups
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
require_once __DIR__ . '/backup-config.php';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function respond(bool $success, string $message, array $extra = []): void {
    // Discard any stray PHP output (warnings, notices) that would corrupt JSON
    if (ob_get_level()) ob_end_clean();
    echo json_encode(array_merge(['success' => $success, 'message' => $message], $extra),
        JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

/**
 * Build a parameterised INSERT IGNORE or REPLACE INTO for a single row.
 * Returns [sql_string, types_string, values_array] or throws on failure.
 */
function build_upsert(mysqli $conn, string $table, array $row, bool $overwrite): array {
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

// ─── Validate Request ─────────────────────────────────────────────────────────

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(false, 'Only POST requests are accepted.');
}

if (empty($_FILES['backup'])) {
    respond(false, 'No backup file uploaded. Use multipart/form-data with field name "backup".');
}

$file = $_FILES['backup'];

if ($file['error'] !== UPLOAD_ERR_OK) {
    respond(false, 'File upload error code: ' . $file['error']);
}

// Max 100 MB
if ($file['size'] > 100 * 1024 * 1024) {
    respond(false, 'Backup file is too large (max 100 MB).');
}

$raw = file_get_contents($file['tmp_name']);
if ($raw === false) {
    respond(false, 'Could not read uploaded file.');
}

// Auto-detect gzip (magic bytes: 0x1f 0x8b) and decompress transparently
if (strlen($raw) >= 2 && $raw[0] === "\x1f" && $raw[1] === "\x8b") {
    $raw = @gzdecode($raw);
    if ($raw === false) {
        respond(false, 'Backup file appears to be gzip-compressed but could not be decompressed.');
    }
}

$backup = json_decode($raw, true);
if (json_last_error() !== JSON_ERROR_NONE) {
    respond(false, 'Invalid JSON file: ' . json_last_error_msg());
}

// ─── Structural Validation ────────────────────────────────────────────────────

$required_fields = ['backup_version', 'app', 'exported_at', 'data'];
foreach ($required_fields as $field) {
    if (!array_key_exists($field, $backup)) {
        respond(false, "Invalid backup file: missing required field \"{$field}\". This does not appear to be a Rethink backup.");
    }
}

if ($backup['app'] !== 'rethink-admin') {
    respond(false, 'Backup file is not from a Rethink admin instance (app mismatch).');
}

$supported_versions = ['1.0', '1.1', '2.0'];
if (!in_array($backup['backup_version'], $supported_versions, true)) {
    respond(false, "Unsupported backup version: {$backup['backup_version']}. Supported versions: " . implode(', ', $supported_versions));
}

if (!is_array($backup['data'])) {
    respond(false, 'Backup data section is invalid.');
}

// ─── Checksum Verification (v2.0+) ───────────────────────────────────────────

if (!empty($backup['checksum'])) {
    $computed = hash('sha256', json_encode($backup['data'], JSON_UNESCAPED_UNICODE));
    if ($computed !== $backup['checksum']) {
        respond(false, 'Checksum mismatch — this backup file is corrupted or incomplete. The data does not match the embedded SHA-256 hash.');
    }
}

// ─── Import Settings ──────────────────────────────────────────────────────────

$conflict = isset($_GET['conflict']) && $_GET['conflict'] === 'overwrite' ? 'overwrite' : 'skip';
$overwrite = ($conflict === 'overwrite');

// Tables in dependency order (auto-detect + fallback for fresh machines)
$table_order = array_unique(array_merge(get_backup_tables($conn), BACKUP_TABLES_FALLBACK));

// ─── Schema Bootstrap (v1.1+): Create Tables If They Don't Exist ─────────────
// Only runs when the backup contains a schema section (v1.1+).
// Uses CREATE TABLE IF NOT EXISTS so existing tables are never dropped.

$schema_errors = [];
if (!empty($backup['schema']) && is_array($backup['schema'])) {
    foreach ($backup['schema'] as $table => $ddl) {
        if (empty($ddl)) continue;

        // Convert  CREATE TABLE `name`  →  CREATE TABLE IF NOT EXISTS `name`
        $safe_ddl = preg_replace(
            '/^CREATE TABLE\s+`/i',
            'CREATE TABLE IF NOT EXISTS `',
            $ddl
        );

        if (!$conn->query($safe_ddl)) {
            $schema_errors[] = "[schema] Could not create table `{$table}`: " . $conn->error;
        }
    }
}

// ─── Run Import Inside Transaction ───────────────────────────────────────────

// Temporarily disable FK checks to allow flexible restore order
$conn->query("SET FOREIGN_KEY_CHECKS = 0");
$conn->begin_transaction();

$imported = [];
$errors   = [];
$total_imported = 0;
$total_skipped  = 0;

try {
    foreach ($table_order as $table) {
        if (!isset($backup['data'][$table]) || !is_array($backup['data'][$table])) {
            // Table not present in this backup — skip silently
            $imported[$table] = 0;
            continue;
        }

        $rows = $backup['data'][$table];
        $table_count = 0;

        foreach ($rows as $row) {
            if (empty($row) || !is_array($row)) continue;

            try {
                [$sql, $types, $values] = build_upsert($conn, $table, $row, $overwrite);

                $stmt = $conn->prepare($sql);
                if (!$stmt) {
                    throw new RuntimeException("Prepare failed for {$table}: " . $conn->error);
                }

                if (!empty($values)) {
                    $refs = [];
                    foreach ($values as &$v) $refs[] = &$v;
                    $stmt->bind_param($types, ...$refs);
                }

                $stmt->execute();
                $affected = $stmt->affected_rows;
                $stmt->close();

                if ($affected > 0) {
                    $table_count++;
                    $total_imported++;
                } else {
                    $total_skipped++;
                }
            } catch (Exception $rowEx) {
                $errors[] = "[{$table}] Row error: " . $rowEx->getMessage();
                // Continue processing remaining rows rather than aborting
            }
        }

        $imported[$table] = $table_count;
    }

    $conn->commit();
} catch (Exception $e) {
    $conn->rollback();
    $conn->query("SET FOREIGN_KEY_CHECKS = 1");
    $conn->close();
    respond(false, 'Import failed and was rolled back: ' . $e->getMessage(), ['errors' => $errors]);
}

$conn->query("SET FOREIGN_KEY_CHECKS = 1");
$conn->close();

// Log the backup restore action (best effort, outside the transaction)
// ...already committed so we can't log to activity_log reliably here

respond(true, 'Backup restored successfully.', [
    'conflict_mode'    => $conflict,
    'backup_version'   => $backup['backup_version'],
    'exported_at'      => $backup['exported_at'],
    'schema_applied'   => !empty($backup['schema']),
    'schema_errors'    => $schema_errors,
    'total_imported'   => $total_imported,
    'total_skipped'    => $total_skipped,
    'imported'         => $imported,
    'error_count'      => count($errors),
    'errors'           => $errors,
]);
