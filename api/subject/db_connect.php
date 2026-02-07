<?php
// Set headers for JSON response and CORS
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST, GET, PUT, DELETE");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

// Database credentials
define('DB_HOST', 'sql310.infinityfree.com');
define('DB_USER', 'if0_39302076'); // Your database username
define('DB_PASS', 'ig8FF0ewh49YW');     // Your database password
define('DB_NAME', 'if0_39302076_admin_examtaking');

// Create database connection
$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);

// Check connection
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

// --- FIX: Set the character set and timezone AFTER connecting ---
$conn->set_charset("utf8mb4");
$conn->query("SET time_zone = '+06:00'");
?>
