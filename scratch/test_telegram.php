<?php
// Send a test message via cURL
$tgToken = '8696072711:AAHUQU5HJMvK-9uZTEFKJbp2ptJ7eArUIdg';
$tgChatId = '1569762173';

$message = "✅ Pomodoro Complete!\n📚 Subject: Test Subject\n⏱ Duration: 25 min\n🕐 Completed at " . date('h:i A');

$url = "https://api.telegram.org/bot{$tgToken}/sendMessage";
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
    'chat_id' => $tgChatId,
    'text' => $message
]));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_TIMEOUT, 5);
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

echo "HTTP: $httpCode\n";
$result = json_decode($response, true);
echo ($result && $result['ok']) ? "SUCCESS: Message sent to Telegram!\n" : "FAILED: $response\n";
?>
