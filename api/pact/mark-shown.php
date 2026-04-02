<?php
/**
 * RE-THINK: Daily Study Pact Dismissal API
 * Purpose: Marks today's pact as "shown" even if no commitment is made.
 */
header('Content-Type: application/json');
require_once __DIR__ . '/../subject/db_connect.php';

date_default_timezone_set('Asia/Dhaka');

function getLogicalDate() {
    $hour = (int)date('H');
    return ($hour < 5) ? date('Y-m-d', strtotime('-1 day')) : date('Y-m-d');
}

try {
    $today = getLogicalDate();
    
    // Insert a blank placeholder if none exists, set is_shown = 1
    $stmt = $conn->prepare("
        INSERT INTO study_pacts (pact_date, is_shown, status)
        VALUES (?, 1, 'skipped')
        ON DUPLICATE KEY UPDATE is_shown = 1
    ");

    $stmt->bind_param("s", $today);
    
    if ($stmt->execute()) {
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'message' => $stmt->error]);
    }
    
    $stmt->close();
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}

$conn->close();
?>
