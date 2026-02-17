<?php
require_once 'api/subject/db_connect.php';

$sql = "CREATE TABLE IF NOT EXISTS question_attempts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    question_id INT NOT NULL,
    exam_id INT NOT NULL,
    selected_answer VARCHAR(10) NULL,
    is_correct TINYINT(1) NULL,
    attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX (question_id),
    INDEX (exam_id)
)";

if ($conn->query($sql) === TRUE) {
    echo "Table question_attempts created successfully\n";
} else {
    echo "Error creating table: " . $conn->error . "\n";
}

$conn->close();
?>
