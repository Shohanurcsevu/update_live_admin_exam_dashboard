<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

require_once '../subject/db_connect.php';

// Calculate study time statistics

$days = isset($_GET['days']) ? intval($_GET['days']) : 30;

try {
    // Total study time calculation
    // We prioritize actual time spent (time_used_seconds) if available
    // Otherwise fallback to 1 minute per question estimate
    $sql = "
        SELECT 
            SUM(p.time_used_seconds) as total_seconds,
            COUNT(q.id) as total_questions,
            COUNT(DISTINCT p.id) as total_sessions,
            AVG(p.time_used_seconds) as avg_seconds_per_session
        FROM performance p
        JOIN exams e ON p.exam_id = e.id
        LEFT JOIN questions q ON e.id = q.exam_id
        WHERE p.attempt_time >= DATE_SUB(CURRENT_DATE, INTERVAL ? DAY)
        AND q.is_deleted = 0
    ";
    
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("i", $days);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();
    
    // Convert seconds to hours (if time_used_seconds is NULL/0, fallback to questions * 60)
    $seconds = floatval($row['total_seconds'] ?? 0);
    if ($seconds == 0 && intval($row['total_questions'] ?? 0) > 0) {
        $seconds = intval($row['total_questions']) * 60;
    }
    
    $total_hours = round($seconds / 3600, 1);
    
    // Average session
    $avg_seconds = floatval($row['avg_seconds_per_session'] ?? 0);
    if ($avg_seconds == 0 && intval($row['total_sessions'] ?? 0) > 0) {
        $avg_seconds = ($seconds / $row['total_sessions']);
    }
    $avg_session_minutes = round($avg_seconds / 60, 0);
    
    $total_sessions = intval($row['total_sessions'] ?? 0);
    
    // This week's study time
    $week_sql = "
        SELECT 
            SUM(p.time_used_seconds) as week_seconds,
            COUNT(q.id) as week_questions
        FROM performance p
        JOIN exams e ON p.exam_id = e.id
        LEFT JOIN questions q ON e.id = q.exam_id
        WHERE p.attempt_time >= DATE_SUB(CURRENT_DATE, INTERVAL 7 DAY)
        AND q.is_deleted = 0
    ";
    
    $week_result = $conn->query($week_sql);
    $week_row = $week_result->fetch_assoc();
    
    $week_seconds = floatval($week_row['week_seconds'] ?? 0);
    if ($week_seconds == 0 && intval($week_row['week_questions'] ?? 0) > 0) {
        $week_seconds = intval($week_row['week_questions']) * 60;
    }
    $week_hours = round($week_seconds / 3600, 1);
    
    // Today's study time
    $today_sql = "
        SELECT 
            SUM(p.time_used_seconds) as today_seconds,
            COUNT(q.id) as today_questions
        FROM performance p
        JOIN exams e ON p.exam_id = e.id
        LEFT JOIN questions q ON e.id = q.exam_id
        WHERE DATE(p.attempt_time) = CURRENT_DATE
        AND q.is_deleted = 0
    ";
    
    $today_result = $conn->query($today_sql);
    $today_row = $today_result->fetch_assoc();
    
    $today_seconds = floatval($today_row['today_seconds'] ?? 0);
    if ($today_seconds == 0 && intval($today_row['today_questions'] ?? 0) > 0) {
        $today_seconds = intval($today_row['today_questions']) * 60;
    }
    $today_hours = round($today_seconds / 3600, 1);
    
    // Helper to format seconds
    function format_seconds($seconds) {
        if ($seconds <= 0) return "0m";
        $h = floor($seconds / 3600);
        $m = floor(($seconds % 3600) / 60);
        if ($h > 0) return "{$h}h {$m}m";
        return "{$m}m";
    }

    echo json_encode([
        'success' => true,
        'total_hours' => $total_hours,
        'total_formatted' => format_seconds($seconds),
        'avg_session_minutes' => $avg_session_minutes,
        'total_sessions' => $total_sessions,
        'this_week_hours' => $week_hours,
        'week_formatted' => format_seconds($week_seconds),
        'today_hours' => $today_hours,
        'today_formatted' => format_seconds($today_seconds),
        'period_days' => $days
    ]);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => 'Failed to fetch study time: ' . $e->getMessage()
    ]);
}

$conn->close();
?>
