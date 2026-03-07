<?php
header('Content-Type: application/json');
require_once '../subject/db_connect.php';

// Handle OPTIONS preflight for CORS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode([
        'success' => false, 
        'error' => 'Invalid request method.',
        'message' => 'This API endpoint only accepts POST requests from the dashboard tracker. To test manually, use a tool like Postman or check your dashboard console.'
    ]);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);

if (!$data) {
    echo json_encode(['success' => false, 'error' => 'Empty or invalid JSON payload.']);
    exit;
}

if (!isset($data['bpm']) || !isset($data['is_active'])) {
    echo json_encode(['success' => false, 'error' => 'Missing required fields: bpm or is_active', 'received' => $data]);
    exit;
}

$bpm = (int)$data['bpm'];
$isActive = (int)$data['is_active'];

// Rate limit: Don't log if the last log was less than 45 seconds ago
// Using MySQL native TIMESTAMPDIFF to avoid PHP/MySQL timezone mismatches
$checkSql = "SELECT id FROM bpm_logs 
             WHERE timestamp > NOW() - INTERVAL 45 SECOND 
             LIMIT 1";
$result = $conn->query($checkSql);
if ($result && $result->num_rows > 0) {
    echo json_encode(['success' => true, 'message' => 'Rate limited']);
    exit;
}

$stmt = $conn->prepare("INSERT INTO bpm_logs (bpm_value, is_active) VALUES (?, ?)");
$stmt->bind_param("ii", $bpm, $isActive);

if ($stmt->execute()) {
    echo json_encode(['success' => true]);
} else {
    echo json_encode(['success' => false, 'error' => $conn->error]);
}

$stmt->close();
$conn->close();
