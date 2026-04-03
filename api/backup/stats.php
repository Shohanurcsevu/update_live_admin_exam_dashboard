<?php
/**
 * Backup Stats API — lightweight endpoint
 * Returns table names, row counts, AND table metadata (icons, labels).
 * The frontend fetches this to auto-build the table list.
 * GET /api/backup/stats.php
 */

require_once '../subject/db_connect.php';
require_once __DIR__ . '/backup-config.php';

// Auto-detect tables from DB (not hardcoded!)
$tables = get_backup_tables($conn);

$counts = [];
$totalRecords = 0;
$tableMeta = [];

foreach ($tables as $table) {
    $result = @$conn->query("SELECT COUNT(*) AS cnt FROM `{$table}`");
    $row = $result ? $result->fetch_assoc() : null;
    $c = $row ? (int) $row['cnt'] : 0;
    $counts[$table] = $c;
    $totalRecords += $c;
    if ($result) $result->free();

    // Get icon/label for this table (auto-generates for unknown tables)
    $meta = get_table_meta($table);
    $tableMeta[] = [
        'name'  => $table,
        'icon'  => $meta['icon'],
        'label' => $meta['label'],
        'rows'  => $c,
    ];
}

$conn->close();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

echo json_encode([
    'tables'        => count($tables),
    'total_records' => $totalRecords,
    'per_table'     => $counts,
    'table_meta'    => $tableMeta,   // NEW: full metadata for frontend
]);
