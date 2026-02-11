<?php
ini_set('display_errors', 1);
error_reporting(E_ALL);

// Adjust path as needed based on your file structure
require_once __DIR__ . '/../subject/db_connect.php';

$sql = "
CREATE TABLE IF NOT EXISTS study_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    subject_id INT NOT NULL,
    subject_name VARCHAR(255) NOT NULL,
    start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    duration_minutes INT DEFAULT 25,
    remaining_seconds INT NOT NULL,
    status ENUM('active', 'paused', 'completed', 'abandoned') DEFAULT 'active',
    last_heartbeat DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
";

if ($conn->query($sql) === TRUE) {
    echo "Table 'study_sessions' created successfully or already exists.<br>";
    
    // Add session_type column if missing
    $colCheck = $conn->query("SHOW COLUMNS FROM study_sessions LIKE 'session_type'");
    if ($colCheck->num_rows == 0) {
        $conn->query("ALTER TABLE study_sessions ADD COLUMN session_type ENUM('focus', 'break') DEFAULT 'focus' AFTER id");
        echo "Added 'session_type' column.<br>";
    }
    
    // Make subject_id and subject_name nullable if they aren't
    $conn->query("ALTER TABLE study_sessions MODIFY COLUMN subject_id INT NULL");
    $conn->query("ALTER TABLE study_sessions MODIFY COLUMN subject_name VARCHAR(255) NULL");
    
} else {
    echo "Error creating table: " . $conn->error;
}

$conn->close();
?>
