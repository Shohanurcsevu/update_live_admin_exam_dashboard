<?php
$_SERVER['HTTP_HOST'] = 'localhost';
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
require_once 'api/subject/db_connect.php';


echo "--- Lessons Table ---\n";
$res = $conn->query("DESCRIBE lessons");
while($row = $res->fetch_assoc()) {
    echo $row['Field'] . " - " . $row['Type'] . "\n";
}

echo "\n--- Subjects Table ---\n";
$res = $conn->query("DESCRIBE subjects");
while($row = $res->fetch_assoc()) {
    echo $row['Field'] . " - " . $row['Type'] . "\n";
}

echo "\n--- Active Subjects ---\n";
$res = $conn->query("SELECT id, subject_name FROM subjects WHERE is_deleted = 0");
while($row = $res->fetch_assoc()) {
    echo $row['id'] . " - " . $row['subject_name'] . "\n";
}

