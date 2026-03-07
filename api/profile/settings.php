<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *'); 
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

require_once '../subject/db_connect.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    // Fetch settings
    $key = $_GET['key'] ?? null;
    
    if ($key) {
        $stmt = $conn->prepare("SELECT setting_value FROM app_settings WHERE setting_key = ?");
        $stmt->bind_param("s", $key);
        $stmt->execute();
        $result = $stmt->get_result();
        $row = $result->fetch_assoc();
        
        echo json_encode([
            "success" => true,
            "data" => [
                $key => $row ? $row['setting_value'] : null
            ]
        ]);
    } else {
        // Fetch all personalization settings
        $result = $conn->query("SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN ('user_avatar', 'app_font', 'user_name', 'app_accent')");
        $settings = [];
        while ($row = $result->fetch_assoc()) {
            $settings[$row['setting_key']] = $row['setting_value'];
        }
        
        echo json_encode([
            "success" => true,
            "data" => $settings
        ]);
    }
} elseif ($method === 'POST') {
    // Save settings
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['key']) || !isset($input['value'])) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Missing key or value"]);
        exit;
    }
    
    $key = $input['key'];
    $value = $input['value'];
    
    // Whitelist keys to prevent arbitrary data being stored (security)
    $allowed_keys = ['user_avatar', 'app_font', 'user_name', 'app_accent'];
    if (!in_array($key, $allowed_keys)) {
        http_response_code(403);
        echo json_encode(["success" => false, "message" => "Unauthorized key"]);
        exit;
    }

    $stmt = $conn->prepare("INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?");
    $stmt->bind_param("sss", $key, $value, $value);
    
    if ($stmt->execute()) {
        echo json_encode(["success" => true, "message" => "Setting saved successfully"]);
    } else {
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Failed to save setting: " . $conn->error]);
    }
}

$conn->close();
?>
