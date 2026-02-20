<?php
require_once 'api/subject/db_connect.php';

$sql = "CREATE TABLE IF NOT EXISTS question_srs (
    question_id INT PRIMARY KEY,
    next_review_at DATETIME NOT NULL,
    interval_days INT NOT NULL DEFAULT 1,
    consecutive_correct INT NOT NULL DEFAULT 0,
    INDEX (next_review_at)
)";

if ($conn->query($sql)) {
    echo json_encode(["success" => true, "message" => "SRS table created successfully."]);
} else {
    echo json_encode(["success" => false, "message" => "Error: " . $conn->error]);
}

$conn->close();
?>
