<?php
$_SERVER['HTTP_HOST'] = 'localhost';
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
$_GET['action'] = 'list';

// Suppress output of the connect script if any
ob_start();
chdir('api/lesson');
require_once 'subjects.php';
$output = ob_get_clean();

echo $output;
?>
