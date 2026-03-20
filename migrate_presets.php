<?php
// Mocking SERVER variables for CLI context to use db_connect.php
$_SERVER['HTTP_HOST'] = 'localhost';
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';

require_once 'api/subject/db_connect.php';

$sql = "ALTER TABLE exam_presets ADD COLUMN IF NOT EXISTS type ENUM('lesson', 'topic') NOT NULL DEFAULT 'lesson'";

if ($conn->query($sql)) {
    echo "Successfully updated exam_presets table.\n";
} else {
    echo "Error updating table: " . $conn->error . "\n";
}
?>
