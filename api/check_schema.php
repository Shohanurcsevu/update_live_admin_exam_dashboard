<?php
ini_set('display_errors', 1);
error_reporting(E_ALL);
require_once __DIR__ . '/subject/db_connect.php';
header('Content-Type: text/plain');

echo "--- DESCRIBE activity_log ---\n";
$result = $conn->query("DESCRIBE activity_log");
if ($result) {
    while ($row = $result->fetch_assoc()) {
        echo json_encode($row) . "\n";
    }
} else {
    echo "Error: " . $conn->error . "\n";
}

echo "\n--- SHOW CREATE TABLE activity_log ---\n";
$result = $conn->query("SHOW CREATE TABLE activity_log");
if ($result) {
    $row = $result->fetch_assoc();
    echo $row['Create Table'];
} else {
    echo "Error: " . $conn->error . "\n";
}
?>
