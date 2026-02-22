<?php
require_once 'config.php';
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Only POST requests are allowed.']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);

if (!$input || !isset($input['contents'])) {
    echo json_encode(['success' => false, 'message' => 'Invalid request payload.']);
    exit;
}

// Prepare the payload for Gemini API
$payload = [
    'contents' => $input['contents']
];

if (isset($input['generationConfig'])) {
    $payload['generationConfig'] = $input['generationConfig'];
}

$ch = curl_init(GEMINI_API_URL);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json'
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

if (curl_errno($ch)) {
    echo json_encode(['success' => false, 'message' => 'CURL error: ' . curl_error($ch)]);
} else {
    if ($httpCode >= 200 && $httpCode < 300) {
        echo $response;
    } else {
        $errorResponse = json_decode($response, true);
        $errorMessage = $errorResponse['error']['message'] ?? 'Gemini API error (Status: ' . $httpCode . ')';
        echo json_encode(['success' => false, 'message' => $errorMessage, 'debug' => $response]);
    }
}

curl_close($ch);
?>
