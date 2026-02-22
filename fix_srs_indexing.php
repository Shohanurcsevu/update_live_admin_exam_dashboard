<?php
require_once 'api/subject/db_connect.php';

// 1. Deduplicate: Keep the record with the furthest next_review_at for each hash
$sql_dedup = "DELETE s1 FROM question_srs s1
              JOIN question_srs s2 
              ON s1.question_text_hash = s2.question_text_hash 
              AND s1.question_id < s2.question_id";

if ($conn->query($sql_dedup)) {
    echo "Deduplication successful.\n";
} else {
    echo "Deduplication error: " . $conn->error . "\n";
}

// 2. Add Unique Index on question_text_hash if it doesn't exist
$sql_index = "ALTER TABLE question_srs ADD UNIQUE (question_text_hash)";
if ($conn->query($sql_index)) {
    echo "Unique index added to question_text_hash.\n";
} else {
    echo "Index error (might already exist or still have duplicates): " . $conn->error . "\n";
}

$conn->close();
?>
