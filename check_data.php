<?php
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
require_once 'api/subject/db_connect.php';
$res = $conn->query('SELECT setting_key, LENGTH(setting_value) as len FROM app_settings');
if ($res) {
    while($row = $res->fetch_assoc()) {
        echo "Data: " . $row['setting_key'] . ': ' . $row['len'] . " bytes\n";
    }
}
echo "\n--- SCHEMA ---\n";
$res = $conn->query('DESCRIBE app_settings');
while($row = $res->fetch_assoc()) {
    echo $row['Field'] . ': ' . $row['Type'] . "\n";
}
?>
