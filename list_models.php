<?php
require_once 'api/ai/config.php';

$url = "https://generativelanguage.googleapis.com/v1beta/models?key=" . GEMINI_API_KEY;

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

echo "HTTP Code: $httpCode\n\n";
echo "Response:\n$response\n";
?>
