<?php
require_once('api/subject/db_connect.php');

$queries = [
    "ALTER TABLE trivia_snapshots ADD COLUMN source_type VARCHAR(20) DEFAULT 'random' AFTER id",
    "ALTER TABLE trivia_snapshots ADD COLUMN source_id INT NULL AFTER source_type",
    "ALTER TABLE trivia_snapshots ADD INDEX idx_source (source_type, source_id)"
];

foreach ($queries as $sql) {
    if ($conn->query($sql) === TRUE) {
        echo "Successfully executed: $sql\n";
    } else {
        echo "Error executing $sql: " . $conn->error . "\n";
    }
}

$conn->close();
?>
