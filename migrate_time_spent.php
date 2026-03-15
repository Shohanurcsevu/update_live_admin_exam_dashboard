<?php
// Bypass environment detection for CLI
define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', ''); 
define('DB_NAME', 'admin_examtaking');

$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);

if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

// Check if column exists
$result = $conn->query("SHOW COLUMNS FROM question_attempts LIKE 'time_spent_seconds'");
if ($result->num_rows == 0) {
    $sql = "ALTER TABLE question_attempts ADD COLUMN time_spent_seconds INT DEFAULT 0 AFTER is_correct";
    if ($conn->query($sql) === TRUE) {
        echo "Column 'time_spent_seconds' added successfully.\n";
    } else {
        echo "Error adding column: " . $conn->error . "\n";
    }
} else {
    echo "Column 'time_spent_seconds' already exists.\n";
}

$conn->close();
?>
