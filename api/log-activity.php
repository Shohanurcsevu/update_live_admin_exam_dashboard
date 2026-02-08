<?php
require_once 'subject/db_connect.php';
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

date_default_timezone_set('Asia/Dhaka');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (isset($data['type']) && isset($data['message'])) {
        $type = $conn->real_escape_string($data['type']);
        $message = $conn->real_escape_string($data['message']);
        $details = isset($data['details']) ? $conn->real_escape_string(json_encode($data['details'])) : null;
        
        $sql = "INSERT INTO activity_log (activity_type, activity_message, activity_details, timestamp) VALUES (?, ?, ?, NOW())";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param("sss", $type, $message, $details);
        
        if ($stmt->execute()) {
            echo json_encode(['success' => true]);
        } else {
            echo json_encode(['success' => false, 'error' => $stmt->error]);
        }
        $stmt->close();
    } else {
        echo json_encode(['success' => false, 'error' => 'Missing required fields']);
    }
} else {
    echo json_encode(['success' => false, 'error' => 'Invalid request method']);
}

$conn->close();
?>
