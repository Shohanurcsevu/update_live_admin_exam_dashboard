<?php
// Mocking the environment for CLI
$_GET['action'] = 'mark_revised';
$_GET['id'] = 1; // Assuming exam ID 1 exists
$_GET['target'] = 'today';

require_once 'api/exam/exam.php';

// This script will execute mark_revised and output the JSON result.
// Note: We need to make sure db_connect works in CLI (user rules say it should have php_sapi_name check).
?>
