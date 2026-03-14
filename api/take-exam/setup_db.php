<?php
// Force local settings for CLI
define('DB_HOST_LOCAL', 'localhost');
define('DB_USER_LOCAL', 'root');
define('DB_PASS_LOCAL', ''); 
define('DB_NAME_LOCAL', 'admin_examtaking');

$conn = new mysqli(DB_HOST_LOCAL, DB_USER_LOCAL, DB_PASS_LOCAL, DB_NAME_LOCAL);

if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

$sql = "CREATE TABLE IF NOT EXISTS exam_setup_presets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    num_questions INT DEFAULT NULL,
    priorities VARCHAR(20) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;";

if ($conn->query($sql) === TRUE) {
    echo "Table exam_setup_presets created successfully\n";
    
    // Check if defaults already exist
    $check = $conn->query("SELECT COUNT(*) as total FROM exam_setup_presets");
    $row = $check->fetch_assoc();
    
    if ($row['total'] == 0) {
        $stmt = $conn->prepare("INSERT INTO exam_setup_presets (name, num_questions, priorities) VALUES (?, ?, ?)");
        
        $defaults = [
            ["Focus P1", 20, "1"],
            ["Full Mock", null, "0,1,2,3"],
            ["Quick Drill", 10, "0,1,2,3"]
        ];
        
        foreach ($defaults as $d) {
            $stmt->bind_param("sis", $d[0], $d[1], $d[2]);
            $stmt->execute();
        }
        echo "Default presets inserted successfully\n";
    }

    // Create Active Sessions table (NEW: for cross-device check)
    $sql_active = "CREATE TABLE IF NOT EXISTS active_exam_sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        exam_id INT NOT NULL,
        exam_title VARCHAR(255),
        start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status ENUM('ACTIVE', 'COMPLETED', 'CANCELLED') DEFAULT 'ACTIVE',
        current_state LONGTEXT DEFAULT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;";
    
    if ($conn->query($sql_active) === TRUE) {
        echo "Table active_exam_sessions created/verified successfully\n";
    } else {
        echo "Error creating table active_exam_sessions: " . $conn->error . "\n";
    }
} else {
    echo "Error creating table: " . $conn->error . "\n";
}

$conn->close();
?>
