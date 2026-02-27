<?php
require_once('api/subject/db_connect.php');

$sql = "CREATE TABLE IF NOT EXISTS trivia_snapshots (
    id INT AUTO_INCREMENT PRIMARY KEY,
    normalized_score INT,
    accuracy FLOAT,
    avg_speed FLOAT,
    max_streak INT,
    level_reached INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)";

if ($conn->query($sql) === TRUE) {
    echo "Table trivia_snapshots created successfully";
} else {
    echo "Error creating table: " . $conn->error;
}

$conn->close();
?>
