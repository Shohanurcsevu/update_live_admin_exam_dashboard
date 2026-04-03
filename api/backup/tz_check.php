<?php
require_once '../subject/db_connect.php';
header('Content-Type: text/plain');
echo "=== user_streaks structure ===\n";
$r = $conn->query("SHOW CREATE TABLE user_streaks");
if ($r && ($row = $r->fetch_row())) echo $row[1] . "\n\n";
echo "=== streak_activity_log structure ===\n";
$r = $conn->query("SHOW CREATE TABLE streak_activity_log");
if ($r && ($row = $r->fetch_row())) echo $row[1] . "\n\n";
$conn->close();
