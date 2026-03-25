<?php
error_reporting(0);
ini_set('display_errors', 0);
ob_start();

require_once 'config.php';
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    ob_end_clean();
    echo json_encode(['success' => false, 'message' => 'Only POST requests are allowed.']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);

if (!$input || !isset($input['contents'])) {
    ob_end_clean();
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

// Add permissive safety settings to avoid accidental blocks during JSON repair
$payload['safetySettings'] = [
    ["category" => "HARM_CATEGORY_HARASSMENT", "threshold" => "BLOCK_NONE"],
    ["category" => "HARM_CATEGORY_HATE_SPEECH", "threshold" => "BLOCK_NONE"],
    ["category" => "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold" => "BLOCK_NONE"],
    ["category" => "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold" => "BLOCK_NONE"]
];

// Determine which model to use (passed from frontend or default)
$selectedModel = $input['model'] ?? GEMINI_MODEL;
$api_url = get_gemini_api_url($selectedModel);

$ch = curl_init($api_url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json'
]);
curl_setopt($ch, CURLOPT_TIMEOUT, 120); // 2 minutes for processing complex images

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

if (curl_errno($ch)) {
    ob_end_clean();
    echo json_encode(['success' => false, 'message' => 'CURL error: ' . curl_error($ch)]);
} else {
    ob_end_clean();
    if ($httpCode >= 200 && $httpCode < 300) {
        if (empty($response)) {
            echo json_encode(['success' => false, 'message' => 'Gemini returned an empty response body.', 'status' => $httpCode]);
        } else {
            // Log usage to database
            $data = json_decode($response, true);
            if ($data && isset($data['usageMetadata'])) {
                require_once __DIR__ . '/../subject/db_connect.php';
                $usage = $data['usageMetadata'];
                $promptTokens = $usage['promptTokenCount'] ?? 0;
                $candidatesTokens = $usage['candidatesTokenCount'] ?? 0;
                $totalTokens = $usage['totalTokenCount'] ?? 0;
                
                $stmt = $conn->prepare("INSERT INTO ai_usage_log (model_name, prompt_tokens, completion_tokens, total_tokens) VALUES (?, ?, ?, ?)");
                $stmt->bind_param("siii", $selectedModel, $promptTokens, $candidatesTokens, $totalTokens);
                $stmt->execute();
                $stmt->close();
            }
            echo $response;
        }
    } else {
        $errorResponse = json_decode($response, true);
        if (!$errorResponse) {
            echo json_encode(['success' => false, 'message' => 'Gemini returned an error page (Status ' . $httpCode . ').', 'debug' => substr($response, 0, 500)]);
        } else {
            $errorMessage = $errorResponse['error']['message'] ?? 'Gemini API error (Status: ' . $httpCode . ')';
            echo json_encode(['success' => false, 'message' => $errorMessage, 'debug' => $errorResponse]);
        }
    }
}
?>
