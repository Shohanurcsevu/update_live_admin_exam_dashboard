<?php
$_SERVER['HTTP_HOST'] = 'localhost';
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';

// Mock the input data
$data = [
    'attempt_uuid' => 'take-exam-883',
    'exam_id' => 883, // Assuming this ID might be problematic or just to test
    'answers' => [
        '1' => 'A',
        '2' => 'B'
    ],
    'start_time' => date('Y-m-d H:i:s'),
    'end_time' => date('Y-m-d H:i:s'),
    'duration_used' => 60,
    'checksum' => 'dummy'
];

// Instead of php://input, we'll manually set $data in the script if we were to include it, 
// but it's easier to just run it via CLI and pass the input.

// Let's create a temporary file with the JSON payload
file_put_contents('debug_payload.json', json_encode($data));

// Run the script and capture output
// We'll use popen or just run_command later.
?>
