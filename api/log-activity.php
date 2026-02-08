<?php
// Enable error reporting for debugging
ini_set('display_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . '/subject/db_connect.php';
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

date_default_timezone_set('Asia/Dhaka');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (isset($data['type']) && isset($data['message'])) {
        try {
            $type = $data['type'];
            $message = trim($data['message']);
            
            // Handle details: try to encode, fallback to NULL if failed or empty
            $details = null;
            if (isset($data['details']) && $data['details'] !== null) {
                $encoded = json_encode($data['details'], JSON_UNESCAPED_UNICODE);
                if ($encoded !== false) {
                    $details = $encoded;
                }
            }

            // Prepare statement
            $sql = "INSERT INTO activity_log (activity_type, activity_message, activity_details, timestamp) VALUES (?, ?, ?, NOW())";
            $stmt = $conn->prepare($sql);
            
            if (!$stmt) {
                throw new Exception("Prepare failed: " . $conn->error);
            }

            // Bind parameters ("sss" works for string or null)
            $stmt->bind_param("sss", $type, $message, $details);
            
            if ($stmt->execute()) {
                echo json_encode(['success' => true]);
            } else {
                // Check if it's the constraint violation specifically
                if ($conn->errno == 3819) { // CHECK constraint violated
                     throw new Exception("JSON constraint failed. Details: " . ($details ?? 'NULL'));
                }
                throw new Exception("Execute failed: " . $stmt->error);
            }
            $stmt->close();
            
        } catch (Exception $e) {
            // Catch ANY exception (mysqli or logic)
            http_response_code(500); // Optional, but good for client to know
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
    } else {
        echo json_encode(['success' => false, 'error' => 'Missing required fields']);
    }
} else {
    echo json_encode(['success' => false, 'error' => 'Invalid request method']);
}

$conn->close();
?>
