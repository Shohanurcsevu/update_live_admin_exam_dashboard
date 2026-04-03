<?php
/**
 * Database Maintenance API
 * Archives/deletes old records to keep the database lean.
 *
 * GET  ?action=stats                  → row counts + estimated cleanup
 * POST ?action=cleanup&days=90        → delete activity_log older than N days
 * POST ?action=optimize               → OPTIMIZE TABLE for all tables
 */

set_time_limit(120);
ini_set('memory_limit', '64M');

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

require_once '../subject/db_connect.php';
require_once __DIR__ . '/backup-config.php';

// ─── Tables from shared config ───────────────────────────────────────────────

$ALL_TABLES = get_backup_tables($conn);

// CLEANUP_TABLES is defined in backup-config.php

// ─── Helpers ─────────────────────────────────────────────────────────────────

function respond_json($data) {
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

// ─── Route ───────────────────────────────────────────────────────────────────

$action = $_GET['action'] ?? '';

if ($action === 'stats') {
    // ── Return current row counts + how many are "old" per configurable days ──
    $days = max(1, intval($_GET['days'] ?? 90));
    $cutoff = date('Y-m-d H:i:s', strtotime("-{$days} days"));

    $stats = [];
    $totalRows = 0;
    $totalCleanable = 0;

    // All tables: row counts
    foreach ($ALL_TABLES as $table) {
        $r = $conn->query("SELECT COUNT(*) AS cnt FROM `{$table}`");
        $cnt = ($r && ($row = $r->fetch_assoc())) ? (int)$row['cnt'] : 0;
        if ($r) $r->free();

        $entry = ['table' => $table, 'rows' => $cnt, 'cleanable' => 0];
        $totalRows += $cnt;

        // If cleanable, count old rows
        if (isset($CLEANUP_TABLES[$table])) {
            $col = $CLEANUP_TABLES[$table]['date_col'];
            $r2 = $conn->query("SELECT COUNT(*) AS cnt FROM `{$table}` WHERE `{$col}` < '{$cutoff}'");
            $old = ($r2 && ($row2 = $r2->fetch_assoc())) ? (int)$row2['cnt'] : 0;
            if ($r2) $r2->free();
            $entry['cleanable'] = $old;
            $entry['date_col'] = $col;
            $entry['label'] = $CLEANUP_TABLES[$table]['label'];
            $totalCleanable += $old;
        }

        $stats[] = $entry;
    }

    // Database size
    $dbSize = 0;
    $r = $conn->query("SELECT SUM(data_length + index_length) AS size FROM information_schema.tables WHERE table_schema = '" . DB_NAME . "'");
    if ($r && ($row = $r->fetch_assoc())) $dbSize = (int)$row['size'];
    if ($r) $r->free();

    $conn->close();

    respond_json([
        'days'             => $days,
        'cutoff'           => $cutoff,
        'total_rows'       => $totalRows,
        'total_cleanable'  => $totalCleanable,
        'db_size_bytes'    => $dbSize,
        'tables'           => $stats,
    ]);

} elseif ($action === 'cleanup' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    // ── Delete old rows from cleanable tables ─────────────────────────────────
    $days = max(1, intval($_GET['days'] ?? 90));
    $cutoff = date('Y-m-d H:i:s', strtotime("-{$days} days"));

    $results = [];
    $totalDeleted = 0;
    $errors = [];

    foreach ($CLEANUP_TABLES as $table => $info) {
        $col = $info['date_col'];
        $stmt = $conn->prepare("DELETE FROM `{$table}` WHERE `{$col}` < ?");
        $stmt->bind_param('s', $cutoff);

        if ($stmt->execute()) {
            $deleted = $stmt->affected_rows;
            $results[$table] = $deleted;
            $totalDeleted += $deleted;
        } else {
            $errors[] = "[{$table}] " . $stmt->error;
        }
        $stmt->close();
    }

    $conn->close();

    respond_json([
        'success'       => empty($errors),
        'days'          => $days,
        'cutoff'        => $cutoff,
        'total_deleted' => $totalDeleted,
        'per_table'     => $results,
        'errors'        => $errors,
    ]);

} elseif ($action === 'optimize' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    // ── OPTIMIZE TABLE to reclaim disk space after deletes ─────────────────────
    $results = [];
    $errors = [];

    foreach ($ALL_TABLES as $table) {
        $r = $conn->query("OPTIMIZE TABLE `{$table}`");
        if ($r) {
            $row = $r->fetch_assoc();
            $results[$table] = $row['Msg_text'] ?? 'OK';
            $r->free();
        } else {
            $errors[] = "[{$table}] " . $conn->error;
        }
    }

    $conn->close();

    respond_json([
        'success' => empty($errors),
        'tables'  => $results,
        'errors'  => $errors,
    ]);

} else {
    $conn->close();
    http_response_code(400);
    respond_json(['error' => 'Invalid action. Use ?action=stats, ?action=cleanup&days=90, or ?action=optimize']);
}
