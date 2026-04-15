<?php
require_once 'api/subject/db_connect.php';
echo "--- TABLES ---\n";
$res = $conn->query("SHOW TABLES");
while ($row = $res->fetch_array()) {
    echo $row[0] . "\n";
}
echo "\n--- APP SETTINGS ---\n";
$res = $conn->query("SELECT * FROM app_settings");
while ($row = $res->fetch_assoc()) {
    echo $row['setting_key'] . " = " . $row['setting_value'] . "\n";
}
