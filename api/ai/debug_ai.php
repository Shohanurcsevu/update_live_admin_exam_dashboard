<?php
require_once 'config.php';
header("Content-Type: text/plain; charset=UTF-8");

echo "AI Connectivity Debugger\n";
echo "========================\n\n";

echo "Configured Model: " . GEMINI_MODEL . "\n";
echo "API Endpoint Path: " . parse_url(GEMINI_API_URL, PHP_URL_PATH) . "\n\n";

// 1. Try to list available models
echo "Step 1: Listing available models for your API key...\n";
$listUrl = "https://generativelanguage.googleapis.com/v1beta/models?key=" . GEMINI_API_KEY;
$ch = curl_init($listUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

if ($httpCode === 200) {
    $data = json_decode($response, true);
    if (isset($data['models'])) {
        echo "Successfully retrieved model list!\n";
        foreach ($data['models'] as $m) {
            echo " - " . $m['name'] . " (Supported: " . implode(', ', $m['supportedGenerationMethods']) . ")\n";
        }
    } else {
        echo "No models found in response.\n";
    }
} else {
    echo "Failed to list models. HTTP Code: " . $httpCode . "\n";
    echo "Response: " . $response . "\n";
}

echo "\nStep 2: Testing connectivity with potential models...\n";

$modelsToTest = ['gemini-2.0-flash', 'gemini-flash-latest', 'gemini-1.5-flash'];

foreach ($modelsToTest as $mName) {
    echo "--- Testing $mName ---\n";
    $testUrl = "https://generativelanguage.googleapis.com/v1beta/models/" . $mName . ":generateContent?key=" . GEMINI_API_KEY;
    $testPayload = [
        'contents' => [['parts' => [['text' => 'Hi. Respond with "OK".']]]]
    ];
    $ch = curl_init($testUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($testPayload));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    
    echo "HTTP Code: $httpCode\n";
    echo "Response: " . substr($response, 0, 200) . "...\n\n";
}
?>
