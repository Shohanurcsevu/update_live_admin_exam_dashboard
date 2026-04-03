<?php
require_once __DIR__ . '/../subject/db_connect.php';
$r = $conn->query("SHOW TABLES");
$tables = [];
while ($row = $r->fetch_row()) {
    $tables[] = $row[0];
}
echo implode("\n", $tables);
