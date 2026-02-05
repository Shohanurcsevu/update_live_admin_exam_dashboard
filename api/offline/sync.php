<?php
/**
 * Offline Sync API
 */

// Enable error reporting to find the cause of the 500 error
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Include database connection using relative path (safer for some environments)
require_once '../subject/db_connect.php';

// Set headers for JSON response
header('Content-Type: application/json');

// Check if last_sync is provided
$last_sync = isset($_GET['last_sync']) ? $_GET['last_sync'] : null;

// Function to fetch changes for a specific table
function get_table_changes($conn, $table, $last_sync) {
    if (!$last_sync) {
        // Initial sync: fetch all non-deleted records
        $sql = "SELECT * FROM $table WHERE is_deleted = 0";
        $stmt = $conn->prepare($sql);
    } else {
        // Incremental sync: fetch changed or deleted records since last sync
        $sql = "SELECT * FROM $table WHERE updated_at > ?";
        $stmt = $conn->prepare($sql);
        if ($stmt) {
            $stmt->bind_param("s", $last_sync);
        }
    }
    
    if (!$stmt) {
        throw new Exception("Failed to prepare statement for table '$table': " . $conn->error . ". (Make sure to run the database migration script!)");
    }
    
    if (!$stmt->execute()) {
        throw new Exception("Failed to execute sync for table '$table': " . $stmt->error);
    }
    
    $result = $stmt->get_result();
    $changes = [];
    
    while ($row = $result->fetch_assoc()) {
        if ($table === 'questions' && isset($row['options'])) {
            $row['options'] = json_decode($row['options'], true);
        }
        $changes[] = $row;
    }
    
    $stmt->close();
    return $changes;
}

// Get current server time for the next sync
$server_time_query = $conn->query("SELECT NOW() as `current_time` ");
if (!$server_time_query) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $conn->error]);
    exit();
}
$server_time_row = $server_time_query->fetch_assoc();
$server_time = $server_time_row['current_time'];

// Tables to sync
$tables = ['subjects', 'lessons', 'topics', 'exams', 'questions'];
$response_changes = [];

try {
    foreach ($tables as $table) {
        $response_changes[$table] = get_table_changes($conn, $table, $last_sync);
    }

    echo json_encode([
        'success' => true,
        'server_time' => $server_time,
        'changes' => $response_changes
    ]);

} catch (Exception $e) {
    // Return a 200 with success: false instead of a 500 to see the message in the UI
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}

$conn->close();
?>
