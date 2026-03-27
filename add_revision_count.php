<?php
require 'api/subject/db_connect.php';

$sql = "ALTER TABLE exams ADD COLUMN revision_count INT DEFAULT 0 AFTER is_revision";

if ($conn->query($sql) === TRUE) {
    echo "Column 'revision_count' added successfully to 'exams' table.\n";
} else {
    if (strpos($conn->error, "Duplicate column name") !== false) {
        echo "Column 'revision_count' already exists.\n";
    } else {
        echo "Error adding column: " . $conn->error . "\n";
    }
}

$conn->close();
?>
