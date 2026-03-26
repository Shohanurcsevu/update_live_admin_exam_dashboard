<?php
require_once 'api/subject/db_connect.php';

function show_columns($conn, $table) {
    echo "\nTable: $table\n";
    $result = $conn->query("SHOW COLUMNS FROM $table");
    while ($row = $result->fetch_assoc()) {
        echo "- {$row['Field']} ({$row['Type']})\n";
    }
}

show_columns($conn, 'exams');
show_columns($conn, 'questions');
$conn->close();
?>
