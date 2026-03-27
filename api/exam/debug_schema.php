<?php
require_once 'db_connect.php';
function desc($conn, $table) {
    echo "--- $table ---\n";
    $res = $conn->query("DESC $table");
    while($row = $res->fetch_assoc()) {
        printf("%-15s %-15s %-10s %-10s\n", $row['Field'], $row['Type'], $row['Null'], $row['Key']);
    }
}
desc($conn, 'questions');
desc($conn, 'question_attempts');
desc($conn, 'performance');
?>
