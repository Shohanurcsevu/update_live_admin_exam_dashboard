<?php
require_once('api/subject/db_connect.php');

$queries = [
    "ALTER TABLE trivia_snapshots ADD COLUMN subject_id INT NULL AFTER source_id",
    "ALTER TABLE trivia_snapshots ADD COLUMN lesson_id INT NULL AFTER subject_id",
    "ALTER TABLE trivia_snapshots ADD COLUMN topic_id INT NULL AFTER lesson_id",
    "ALTER TABLE trivia_snapshots ADD COLUMN exam_id INT NULL AFTER topic_id",
    "CREATE INDEX idx_trivia_hierarchy ON trivia_snapshots(subject_id, lesson_id, topic_id, exam_id)"
];

foreach ($queries as $sql) {
    if ($conn->query($sql)) {
        echo "Success: $sql\n";
    } else {
        echo "Error: " . $conn->error . " ($sql)\n";
    }
}
?>
