<?php
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
$_SERVER['HTTP_HOST'] = 'localhost';
$_GET = [
    'action' => 'list',
    'exclude_custom' => 'true',
    'only_lesson_wise' => 'true',
    'only_topic_wise' => 'true',
    'limit' => 20,
    'offset' => 0
];

// Mock the connection and other dependencies if needed, or just include it
// Since exam.php includes db_connect.php, we need to make sure it works.
include 'api/subject/db_connect.php'; 

// We can capture the output or check the log
ob_start();
include 'api/exam/exam.php';
$output = ob_get_clean();

echo "--- API RESPONSE ---" . PHP_EOL;
echo $output . PHP_EOL;

echo "--- QUERY LOG ---" . PHP_EOL;
if (file_exists('query_log.txt')) {
    echo file_get_contents('query_log.txt');
}
?>
