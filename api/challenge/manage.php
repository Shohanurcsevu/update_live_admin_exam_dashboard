<?php
require_once '../subject/db_connect.php';
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

date_default_timezone_set('Asia/Dhaka');

$action = $_GET['action'] ?? 'get';

if ($action === 'get') {
    // Check if challenge already issued for today
    $sql = "SELECT activity_message, activity_details FROM activity_log WHERE activity_type = 'boss_challenge_issued' AND DATE(timestamp) = CURRENT_DATE LIMIT 1";
    $result = $conn->query($sql);
    
    if ($result && $row = $result->fetch_assoc()) {
        $challenge = json_decode($row['activity_message'], true);
    } else {
        // Issue new challenge
        $exams_target = rand(2, 4);
        $sessions_target = rand(3, 6);
        $deadline = "21:00:00"; // 9 PM
        
        $challenge = [
            'exams' => $exams_target,
            'sessions' => $sessions_target,
            'deadline' => $deadline,
            'issued_at' => date('Y-m-d H:i:s')
        ];
        
        $msg = json_encode($challenge);
        $stmt = $conn->prepare("INSERT INTO activity_log (activity_type, activity_message, timestamp) VALUES ('boss_challenge_issued', ?, NOW())");
        $stmt->bind_param("s", $msg);
        $stmt->execute();
        $stmt->close();
    }
    
    // Check if accepted
    $check_accepted = $conn->query("SELECT id FROM activity_log WHERE activity_type = 'boss_challenge_accepted' AND DATE(timestamp) = CURRENT_DATE LIMIT 1");
    $challenge['is_accepted'] = ($check_accepted && $check_accepted->num_rows > 0);
    
    echo json_encode(['success' => true, 'challenge' => $challenge]);

} elseif ($action === 'accept') {
    $stmt = $conn->prepare("INSERT INTO activity_log (activity_type, activity_message, timestamp) VALUES ('boss_challenge_accepted', 'Challenge Accepted', NOW())");
    $stmt->execute();
    $stmt->close();
    echo json_encode(['success' => true]);
}

$conn->close();
?>
