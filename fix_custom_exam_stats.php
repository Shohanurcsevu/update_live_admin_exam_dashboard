<?php
// FILE: fix_custom_exam_stats.php
// Migration: Add original_question_id to questions table to bridge performance stats for custom exams.

require_once 'api/subject/db_connect.php';

$sql = "ALTER TABLE questions ADD COLUMN IF NOT EXISTS original_question_id INT NULL DEFAULT NULL";

if ($conn->query($sql) === TRUE) {
    echo "Successfully added original_question_id column (or it already existed).\n";
} else {
    echo "Error adding column: " . $conn->error . "\n";
}

// Add index for performance
$index_sql = "CREATE INDEX IF NOT EXISTS idx_original_question_id ON questions(original_question_id)";
if ($conn->query($index_sql) === TRUE) {
    echo "Successfully created index on original_question_id.\n";
} else {
    echo "Error creating index: " . $conn->error . "\n";
}

$conn->close();
?>
