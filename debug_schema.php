<?php
$_SERVER['HTTP_HOST'] = 'localhost';
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
require_once 'api/subject/db_connect.php';

ob_start();
$tables = ['questions', 'performance', 'question_srs', 'question_attempts'];

foreach ($tables as $table) {
    echo "\n" . str_repeat("=", 50) . "\n";
    echo "EXAMINING TABLE: $table\n";
    echo str_repeat("=", 50) . "\n";

    $result = $conn->query("DESCRIBE $table");
    if ($result) {
        printf("%-20s | %-20s | %-5s | %-5s | %-10s\n", "Field", "Type", "Null", "Key", "Default");
        echo str_repeat("-", 70) . "\n";
        while ($row = $result->fetch_assoc()) {
            printf("%-20s | %-20s | %-5s | %-5s | %-10s\n", 
                $row['Field'], $row['Type'], $row['Null'], $row['Key'], $row['Default']);
        }
    } else {
        echo "Error DESCRIBE $table: " . $conn->error . "\n";
    }

    $result = $conn->query("SHOW CREATE TABLE $table");
    if ($result) {
        $row = $result->fetch_assoc();
        echo "\nCREATE TABLE Statement:\n" . $row['Create Table'] . "\n";
    }
}

file_put_contents('schema_dump.txt', ob_get_clean());
$conn->close();
echo "Schema dumped to schema_dump.txt\n";
?>
