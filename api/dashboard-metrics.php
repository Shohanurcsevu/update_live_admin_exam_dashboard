<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *'); // Consider restricting this in production for security
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
require_once 'subject/db_connect.php'; // Reuse the existing connection file

// Function to get count from a table
function get_count($conn, $table_name) {
    $result = $conn->query("SELECT COUNT(*) as count FROM {$table_name}");
    if ($result) {
        return $result->fetch_assoc()['count'];
    }
    return 0;
}

// Fetch counts for all entities
$metrics = [
    'subjects' => get_count($conn, 'subjects'),
    'lessons' => get_count($conn, 'lessons'),
    'topics' => get_count($conn, 'topics'),
    'exams' => get_count($conn, 'exams'),
    'questions' => get_count($conn, 'questions')
];

// Set headers and return JSON
header('Content-Type: application/json');
echo json_encode(['success' => true, 'data' => $metrics]);

$conn->close();
?>
