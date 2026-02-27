<?php
require_once('api/subject/db_connect.php');

$tables = ['subjects', 'lessons', 'topics', 'exams'];
foreach ($tables as $table) {
    echo "--- Table: $table ---\n";
    $r = $conn->query("DESCRIBE $table");
    if ($r) {
        while($row = $r->fetch_assoc()) {
            echo $row['Field'] . " (" . $row['Type'] . ")\n";
        }
    } else {
        echo "Error: Could not query table $table.\n";
    }
    echo "\n";
}
?>
