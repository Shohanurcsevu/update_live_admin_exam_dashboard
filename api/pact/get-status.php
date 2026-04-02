<?php
/**
 * RE-THINK: Daily Study Pact Status API
 * Purpose: Determines if a pact should be shown today and retrieves yesterday's results.
 */
header('Content-Type: application/json');
require_once __DIR__ . '/../subject/db_connect.php';

// Set timezone for consistency with streaks
date_default_timezone_set('Asia/Dhaka');

function getLogicalDate($timestamp = null) {
    if ($timestamp === null) $timestamp = time();
    $hour = (int)date('H', $timestamp);
    // 5 AM Boundary: If it's before 5 AM, it belongs to the previous calendar day
    if ($hour < 5) {
        return date('Y-m-d', strtotime('-1 day', $timestamp));
    }
    return date('Y-m-d', $timestamp);
}

try {
    $today = getLogicalDate();
    $yesterday = date('Y-m-d', strtotime('-1 day', strtotime($today)));

    // 1. Get Today's Pact
    $stmt = $conn->prepare("SELECT * FROM study_pacts WHERE pact_date = ?");
    $stmt->bind_param("s", $today);
    $stmt->execute();
    $todayPact = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    // 2. Get Yesterday's Pact (for Report Card)
    $stmt = $conn->prepare("SELECT * FROM study_pacts WHERE pact_date = ?");
    $stmt->bind_param("s", $yesterday);
    $stmt->execute();
    $yesterdayPact = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    // 3. Process Commitments & Completed Topics for frontend
    if ($todayPact) {
        $todayPact['commitments'] = json_decode($todayPact['commitments'], true);
        $todayPact['completed_topic_ids'] = json_decode($todayPact['completed_topic_ids'], true);
    }

    if ($yesterdayPact) {
        $yesterdayPact['commitments'] = json_decode($yesterdayPact['commitments'], true);
        $yesterdayPact['completed_topic_ids'] = json_decode($yesterdayPact['completed_topic_ids'], true);
        
        // Auto-evaluate yesterday's status if still 'active'
        if ($yesterdayPact['status'] === 'active') {
            $goal = (float)$yesterdayPact['target_hours'];
            $actual = (float)($yesterdayPact['actual_seconds'] / 3600);
            
            if ($actual >= $goal) {
                $status = 'kept';
            } elseif ($actual > 0) {
                $status = 'late'; // Or 'partial'
            } else {
                $status = 'broken';
            }
            
            $update = $conn->prepare("UPDATE study_pacts SET status = ? WHERE id = ?");
            $update->bind_param("si", $status, $yesterdayPact['id']);
            $update->execute();
            $yesterdayPact['status'] = $status;
            $update->close();
        }
    }

    echo json_encode([
        'success' => true,
        'logical_date' => $today,
        'hasPact' => ($todayPact !== null),
        'isShown' => ($todayPact && $todayPact['is_shown'] == 1),
        'today' => $todayPact,
        'yesterday' => $yesterdayPact
    ]);

} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}

$conn->close();
?>
