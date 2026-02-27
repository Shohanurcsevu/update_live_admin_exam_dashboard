<?php
ini_set('display_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . '/../subject/db_connect.php';

$sql = "
CREATE TABLE IF NOT EXISTS job_countdown (
    id INT AUTO_INCREMENT PRIMARY KEY,
    job_name VARCHAR(255) NOT NULL,
    deadline DATETIME NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
";

if ($conn->query($sql) === TRUE) {
    echo json_encode(["success" => true, "message" => "Table 'job_countdown' created successfully or already exists."]);
    
    // Check if we have an initial row
    $res = $conn->query("SELECT COUNT(*) as count FROM job_countdown");
    $count = $res->fetch_assoc()['count'];
    if ($count == 0) {
        $conn->query("INSERT INTO job_countdown (job_name, deadline) VALUES ('Target Job', '2026-04-30 23:59:59')");
        echo json_encode(["info" => "Initial record created."]);
    }
} else {
    echo json_encode(["success" => false, "message" => "Error creating table: " . $conn->error]);
}

$conn->close();
?>
