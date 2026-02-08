<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

require_once 'subject/db_connect.php';

// Track user's last activity and calculate inactivity duration

try {
    // Get the most recent exam attempt
    $sql = "
        SELECT 
            MAX(attempt_time) as last_exam_time,
            COUNT(*) as total_exams_today
        FROM performance
        WHERE DATE(attempt_time) = CURRENT_DATE
    ";
    
    $result = $conn->query($sql);
    $row = $result->fetch_assoc();
    
    $last_exam_time = $row['last_exam_time'];
    $total_exams_today = intval($row['total_exams_today']);
    
    if ($last_exam_time) {
        // Calculate minutes since last exam
        $last_time = new DateTime($last_exam_time);
        $now = new DateTime();
        $diff = $now->diff($last_time);
        $minutes_since = ($diff->days * 24 * 60) + ($diff->h * 60) + $diff->i;
        
        // Determine inactivity level
        $inactivity_level = 'active';
        if ($minutes_since >= 1440) {  // 24 hours
            $inactivity_level = 'critical';
        } elseif ($minutes_since >= 120) {  // 2 hours
            $inactivity_level = 'high';
        } elseif ($minutes_since >= 60) {  // 1 hour
            $inactivity_level = 'moderate';
        } elseif ($minutes_since >= 30) {  // 30 minutes
            $inactivity_level = 'mild';
        }
        
        $is_inactive = $minutes_since >= 30;
    } else {
        // No exams taken yet
        $minutes_since = null;
        $inactivity_level = 'new_user';
        $is_inactive = true; // Mark as true to trigger "Welcome" nudge
    }

    
    // Check if streak is at risk (no exam today and it's after 8 PM)
    $current_hour = intval(date('H'));
    $streak_at_risk = ($total_exams_today === 0 && $current_hour >= 20);
    
    echo json_encode([
        'success' => true,
        'last_exam_time' => $last_exam_time,
        'minutes_since_last_exam' => $minutes_since,
        'is_inactive' => $is_inactive,
        'inactivity_level' => $inactivity_level,
        'total_exams_today' => $total_exams_today,
        'streak_at_risk' => $streak_at_risk,
        'current_hour' => $current_hour
    ]);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => 'Failed to fetch activity status: ' . $e->getMessage()
    ]);
}

$conn->close();
?>
