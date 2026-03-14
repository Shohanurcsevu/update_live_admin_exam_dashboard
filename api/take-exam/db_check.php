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

echo "Connected successfully to " . DB_NAME_LOCAL . "\n";

$result = $conn->query("SHOW TABLES LIKE 'exam_setup_presets'");
if ($result->num_rows > 0) {
    echo "Table 'exam_setup_presets' exists.\n";
} else {
    echo "Table 'exam_setup_presets' DOES NOT exist.\n";
}

$conn->close();
?>
