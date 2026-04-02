<?php
/**
 * RE-THINK: Daily Study Pact Save API
 * Purpose: Commits today's study goals to the database.
 */
header('Content-Type: application/json');
require_once __DIR__ . '/../subject/db_connect.php';

date_default_timezone_set('Asia/Dhaka');

function getLogicalDate() {
    $hour = (int)date('H');
    return ($hour < 5) ? date('Y-m-d', strtotime('-1 day')) : date('Y-m-d');
}

$data = json_decode(file_get_contents("php://input"), true);
$today = getLogicalDate();

if (!$data || !isset($data['commitments']) || !isset($data['target_hours'])) {
    die(json_encode(['success' => false, 'message' => 'Incomplete commitment data.']));
}

try {
    $commitments = json_encode($data['commitments']);
    $targetHours = (float)$data['target_hours'];
    $miniGoal = isset($data['mini_goal']) ? strip_tags($data['mini_goal']) : '';

    // UPSERT: Insert or Update for today
    $stmt = $conn->prepare("
        INSERT INTO study_pacts (pact_date, commitments, target_hours, mini_goal, is_shown, status)
        VALUES (?, ?, ?, ?, 1, 'active')
        ON DUPLICATE KEY UPDATE
            commitments = VALUES(commitments),
            target_hours = VALUES(target_hours),
            mini_goal = VALUES(mini_goal),
            is_shown = 1
    ");

    $stmt->bind_param("ssds", $today, $commitments, $targetHours, $miniGoal);
    
    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'message' => 'Study Pact committed! 🔥']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Failed to save pact: ' . $stmt->error]);
    }
    
    $stmt->close();
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}

$conn->close();
?>
