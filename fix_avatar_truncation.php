<?php
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
require_once 'api/subject/db_connect.php';

// 1. Upgrade column to LONGTEXT to prevent truncation
$sql = "ALTER TABLE app_settings MODIFY setting_value LONGTEXT";
if ($conn->query($sql)) {
    echo "Schema updated: setting_value is now LONGTEXT.\n";
} else {
    echo "Error updating schema: " . $conn->error . "\n";
}

// 2. Clear the truncated avatar if it exists (so user can re-upload fresh)
// Or keep it, but it's likely broken. Let's just update the schema for now.

$conn->close();
?>
