<?php
// Mocking the environment to allow db_connect.php to work
$_SERVER['HTTP_HOST'] = 'localhost';
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';

ob_start();
include 'daily-study-time.php';
$output = ob_get_clean();

file_put_contents('debug_api_response.json', $output);
echo "Captured API response to debug_api_response.json\n";
?>
