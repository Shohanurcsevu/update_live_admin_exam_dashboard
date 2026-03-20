<?php
$_SERVER['HTTP_HOST'] = 'localhost';
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
require_once 'api/subject/db_connect.php';

function check_table($conn, $table) {
    echo "Checking table: $table\n";
    $result = $conn->query("SHOW TABLES LIKE '$table'");
    if ($result->num_rows > 0) {
        echo "Table $table exists.\n";
        $columns = $conn->query("DESCRIBE $table");
        while ($col = $columns->fetch_assoc()) {
            echo "  Column: {$col['Field']} ({$col['Type']})\n";
        }
    } else {
        echo "Table $table DOES NOT EXIST.\n";
    }
    echo "\n";
}

check_table($conn, 'offline_exam_attempts');
check_table($conn, 'performance');
check_table($conn, 'activity_log');
check_table($conn, 'exams');
check_table($conn, 'subjects');
check_table($conn, 'questions');
?>
