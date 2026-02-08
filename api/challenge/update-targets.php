<?php
require_once '../subject/db_connect.php';
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

date_default_timezone_set('Asia/Dhaka');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (isset($data['exams']) && isset($data['sessions'])) {
        $exams = intval($data['exams']);
        $sessions = intval($data['sessions']);
        
        // Validation
        if ($exams < 1 || $exams > 20) {
            echo json_encode(['success' => false, 'error' => 'Exams must be between 1 and 20']);
            exit;
        }
        
        if ($sessions < 1 || $sessions > 20) {
            echo json_encode(['success' => false, 'error' => 'Sessions must be between 1 and 20']);
            exit;
        }
        
        // Get today's date range
        $today = date('Y-m-d');
        $today_start = $today . ' 00:00:00';
        $today_end = $today . ' 23:59:59';
        
        // Check if challenge exists for today
        $check_sql = "SELECT activity_message FROM activity_log WHERE activity_type = 'boss_challenge_issued' AND timestamp BETWEEN '$today_start' AND '$today_end' LIMIT 1";
        $check_res = $conn->query($check_sql);
        
        if ($check_res && $check_res->num_rows > 0) {
            // Update existing challenge
            $row = $check_res->fetch_assoc();
            $challenge_data = json_decode($row['activity_message'], true);
            $challenge_data['exams'] = $exams;
            $challenge_data['sessions'] = $sessions;
            
            $msg = $conn->real_escape_string(json_encode($challenge_data));
            $update_sql = "UPDATE activity_log SET activity_message = '$msg' WHERE activity_type = 'boss_challenge_issued' AND timestamp BETWEEN '$today_start' AND '$today_end'";
            
            if ($conn->query($update_sql)) {
                echo json_encode(['success' => true, 'message' => 'Challenge targets updated']);
            } else {
                echo json_encode(['success' => false, 'error' => $conn->error]);
            }
        } else {
            // Create new challenge with custom targets
            $deadline = "21:00:00";
            $challenge_data = [
                'exams' => $exams,
                'sessions' => $sessions,
                'deadline' => $deadline,
                'issued_at' => date('Y-m-d H:i:s')
            ];
            
            $msg = $conn->real_escape_string(json_encode($challenge_data));
            $insert_sql = "INSERT INTO activity_log (activity_type, activity_message, timestamp) VALUES ('boss_challenge_issued', '$msg', NOW())";
            
            if ($conn->query($insert_sql)) {
                echo json_encode(['success' => true, 'message' => 'Challenge created with custom targets']);
            } else {
                echo json_encode(['success' => false, 'error' => $conn->error]);
            }
        }
    } else {
        echo json_encode(['success' => false, 'error' => 'Missing exams or sessions parameter']);
    }
} else {
    echo json_encode(['success' => false, 'error' => 'Invalid request method']);
}

$conn->close();
?>
