<?php
$_SERVER['HTTP_HOST'] = 'localhost';
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
$_GET['action'] = 'list';
$_GET['limit'] = 5;

// Suppress output of the connect script if any
ob_start();
chdir('api/lesson');
require_once 'lesson.php';
$output = ob_get_clean();

if (!$output) {
    echo "NO OUTPUT FROM API\n";
    // Check if there was an error
    $err = error_get_last();
    if ($err) print_r($err);
}

// The API script usually echoes JSON directly.
echo $output;
?>
