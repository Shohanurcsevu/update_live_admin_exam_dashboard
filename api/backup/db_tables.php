<?php
require_once '../subject/db_connect.php';
header('Content-Type: application/json');
$r = $conn->query("SHOW TABLES");
$tables = [];
while ($row = $r->fetch_row()) {
    $tables[] = $row[0];
}
echo json_encode([
    'count' => count($tables),
    'tables' => $tables
]);
