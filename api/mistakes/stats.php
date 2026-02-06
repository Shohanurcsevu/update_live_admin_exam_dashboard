<?php
/**
 * Mistake Bank Stats API
 */

require_once '../subject/db_connect.php';
header('Content-Type: application/json');

$sql = "SELECT COUNT(*) as total_mistakes FROM mistake_bank WHERE resolved = 0";
$result = $conn->query($sql);

if ($result) {
    $row = $result->fetch_assoc();
    echo json_encode([
        'success' => true,
        'count' => intval($row['total_mistakes'])
    ]);
} else {
    echo json_encode([
        'success' => false,
        'message' => $conn->error
    ]);
}

$conn->close();
?>
