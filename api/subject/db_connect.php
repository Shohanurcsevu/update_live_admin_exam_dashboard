<?php
// Suppress HTML error output — all API consumers expect pure JSON.
// XAMPP ships with display_errors=On which corrupts JSON with <br /><b>Warning</b> HTML.
ini_set('display_errors', '0');
ini_set('log_errors', '1');

// Set headers for JSON response and CORS
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST, GET, PUT, DELETE");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

// --- ENVIRONMENT DETECTION ---
// Detects localhost, 127.0.0.1, or local network IPs (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
$host = $_SERVER['HTTP_HOST'] ?? '';
$is_localhost = (
    php_sapi_name() === 'cli' || 
    in_array($_SERVER['REMOTE_ADDR'] ?? '', ['127.0.0.1', '::1']) || 
    $host === 'localhost' || 
    preg_match('/^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/', $host) ||
    strpos($host, '192.168.') === 0 // Backup check for simple cases
);

if ($is_localhost) {
    // --- LOCAL XAMPP SETTINGS ---
    define('DB_HOST', 'localhost');
    define('DB_USER', 'root');
    define('DB_PASS', ''); 
    define('DB_NAME', 'admin_examtaking');
} else {
    // --- LIVE ONLINE SETTINGS (InfinityFree) ---
    define('DB_HOST', 'sql310.infinityfree.com');
    define('DB_USER', 'if0_39302076');
    define('DB_PASS', 'ig8FF0ewh49YW');
    define('DB_NAME', 'if0_39302076_admin_examtaking');
}

// Create database connection
$conn = @new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);

// ─── Self-Healing: Auto-create DB on localhost if it doesn't exist ────────────
// On a fresh machine, the database won't exist yet.
// Instead of die()-ing, we create it and reconnect automatically.
if ($conn->connect_error && $is_localhost) {
    // Step 1: Connect WITHOUT specifying a database`
    $_boot = @new mysqli(DB_HOST, DB_USER, DB_PASS);
    if (!$_boot->connect_error) {
        // Step 2: Create the database
        $_boot->query(
            "CREATE DATABASE IF NOT EXISTS `" . DB_NAME . "`
             CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
        );
        $_boot->close();

        // Step 3: Reconnect with the now-existing database
        $conn = @new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
    }
    unset($_boot);
}

// Check connection (final check after self-heal attempt)
if ($conn->connect_error) {
    header("Content-Type: application/json; charset=UTF-8");
    die(json_encode([
        "success" => false, 
        "status" => "error", 
        "message" => "Database Connection failed: " . $conn->connect_error,
        "host" => DB_HOST
    ]));
}

// Set charset and timezone
$conn->set_charset("utf8mb4");
$conn->query("SET time_zone = '+06:00'");