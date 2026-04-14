<?php
// One-time script to insert Telegram bot credentials into app_settings
// Run via: cmd /c php scratch/setup_telegram.php

// CLI detection for db_connect.php
if (php_sapi_name() === 'cli') {
    $_SERVER['HTTP_HOST'] = 'localhost';
}

require_once __DIR__ . '/../api/subject/db_connect.php';

$settings = [
    'telegram_bot_token' => '8696072711:AAHUQU5HJMvK-9uZTEFKJbp2ptJ7eArUIdg',
    'telegram_chat_id'   => '1569762173'
];

foreach ($settings as $key => $value) {
    $stmt = $conn->prepare("INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?");
    $stmt->bind_param("sss", $key, $value, $value);
    if ($stmt->execute()) {
        echo "OK: $key = $value\n";
    } else {
        echo "FAIL: $key — " . $stmt->error . "\n";
    }
}

$conn->close();
echo "Done.\n";
?>
