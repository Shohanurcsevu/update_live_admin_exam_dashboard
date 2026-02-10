<?php
// Set up environment to mock being called by API
$_SERVER['REQUEST_METHOD'] = 'GET';
require_once 'api/analytics/daily-study-time.php';
// This will output the JSON Directly.
?>
