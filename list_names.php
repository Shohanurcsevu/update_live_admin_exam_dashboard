<?php
require_once 'api/ai/config.php';
$url = "https://generativelanguage.googleapis.com/v1beta/models?key=" . GEMINI_API_KEY;
$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$response = curl_exec($ch);
$data = json_decode($response, true);
if (isset($data['models'])) {
    foreach ($data['models'] as $m) {
        if (in_array('generateContent', $m['supportedGenerationMethods'])) {
            echo $m['name'] . " (" . $m['displayName'] . ")\n";
        }
    }
} else {
    echo "No models found.\n";
    print_r($data);
}
?>
