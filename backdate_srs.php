<?php
require_once 'api/subject/db_connect.php';
header('Content-Type: text/plain');

// Move all records scheduled for today to midnight so they are due NOW
$sql = "UPDATE question_srs SET next_review_at = '2026-02-21 00:00:00' WHERE DATE(next_review_at) = '2026-02-21'";
if ($conn->query($sql)) {
    echo "Updated " . $conn->affected_rows . " records to be due today (midnight 2026-02-21).\n";
} else {
    echo "Error: " . $conn->error . "\n";
}

// Check count of due records
$count = $conn->query("SELECT COUNT(*) as c FROM question_srs WHERE next_review_at <= NOW()")->fetch_assoc()['c'];
echo "Records now due: $count\n";
$conn->close();
?>
