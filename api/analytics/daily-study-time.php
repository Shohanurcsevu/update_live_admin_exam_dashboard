<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

require_once '../subject/db_connect.php';

date_default_timezone_set('Asia/Dhaka');

// Helper to format seconds
function format_seconds($seconds) {
    if ($seconds <= 0) return "0m";
    $h = floor($seconds / 3600);
    $m = floor(($seconds % 3600) / 60);
    if ($h > 0) return "{$h}h {$m}m";
    return "{$m}m";
}

try {
    // Get today's study time per subject (including Pomodoro sessions)
    // We apply the fallback (1 min/quest) per record to ensure accuracy
    $today_sql = "
        SELECT 
            subject_name,
            subject_id,
            SUM(calculated_seconds) as total_seconds,
            SUM(sessions) as session_count,
            SUM(questions) as question_count
        FROM (
            -- Exam Performance
            SELECT 
                s.subject_name,
                s.id as subject_id,
                CASE 
                    WHEN p.time_used_seconds > 0 THEN p.time_used_seconds 
                    ELSE (SELECT COUNT(*) FROM questions q WHERE q.exam_id = e.id AND q.is_deleted = 0) * 60 
                END as calculated_seconds,
                1 as sessions,
                (SELECT COUNT(*) FROM questions q WHERE q.exam_id = e.id AND q.is_deleted = 0) as questions
            FROM performance p
            JOIN exams e ON p.exam_id = e.id
            JOIN subjects s ON e.subject_id = s.id
            WHERE DATE(p.attempt_time) = CURRENT_DATE

            UNION ALL

            -- Pomodoro Sessions (Mission Board)
            SELECT 
                al.activity_message as subject_name,
                s.id as subject_id,
                SUM(CASE 
                    WHEN al.activity_details LIKE '%duration%'
                    THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(al.activity_details, '$.duration')) AS DECIMAL) * 60 
                    ELSE 25 * 60 
                END) as calculated_seconds,
                COUNT(*) as sessions,
                0 as questions
            FROM activity_log al
            LEFT JOIN subjects s ON al.activity_message = s.subject_name
            WHERE al.activity_type = 'pomodoro_session'
            AND DATE(al.timestamp) = CURRENT_DATE
            GROUP BY al.activity_message, s.id
        ) combined
        GROUP BY subject_id, subject_name
        ORDER BY total_seconds DESC
    ";
    
    $today_result = $conn->query($today_sql);
    if (!$today_result) {
        throw new Exception("Today query failed: " . $conn->error);
    }

    $subjects = [];
    $total_today_seconds = 0;
    
    while ($row = $today_result->fetch_assoc()) {
        $seconds = floatval($row['total_seconds'] ?? 0);
        $total_today_seconds += $seconds;
        
        $subjects[] = [
            'subject_name' => $row['subject_name'],
            'subject_id' => $row['subject_id'] ? intval($row['subject_id']) : null,
            'seconds' => $seconds,
            'formatted' => format_seconds($seconds),
            'session_count' => intval($row['session_count'])
        ];
    }
    
    // Get yesterday's total for comparison (including Pomodoro sessions)
    $yesterday_sql = "
        SELECT 
            SUM(calculated_seconds) as total_seconds,
            SUM(total_questions) as total_questions
        FROM (
            SELECT 
                CASE 
                    WHEN p.time_used_seconds > 0 THEN p.time_used_seconds 
                    ELSE (SELECT COUNT(*) FROM questions q WHERE q.exam_id = p.exam_id AND q.is_deleted = 0) * 60 
                END as calculated_seconds,
                (SELECT COUNT(*) FROM questions q WHERE q.exam_id = p.exam_id AND q.is_deleted = 0) as total_questions
            FROM performance p
            WHERE DATE(p.attempt_time) = DATE_SUB(CURRENT_DATE, INTERVAL 1 DAY)

            UNION ALL

            SELECT 
                SUM(CASE 
                    WHEN activity_details LIKE '%duration%'
                    THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(activity_details, '$.duration')) AS DECIMAL) * 60 
                    ELSE 25 * 60 
                END) as calculated_seconds,
                0 as total_questions
            FROM activity_log
            WHERE activity_type = 'pomodoro_session'
            AND DATE(timestamp) = DATE_SUB(CURRENT_DATE, INTERVAL 1 DAY)
        ) combined
    ";
    
    $yesterday_result = $conn->query($yesterday_sql);
    if (!$yesterday_result) {
        throw new Exception("Yesterday query failed: " . $conn->error);
    }
    $yesterday_row = $yesterday_result->fetch_assoc();
    $yesterday_seconds = floatval($yesterday_row['total_seconds'] ?? 0);
    
    // Calculate improvement
    $improvement = 0;
    $improvement_type = 'neutral'; // neutral, positive, negative
    
    if ($yesterday_seconds > 0) {
        $improvement = (($total_today_seconds - $yesterday_seconds) / $yesterday_seconds) * 100;
        if ($improvement > 5) {
            $improvement_type = 'positive';
        } elseif ($improvement < -5) {
            $improvement_type = 'negative';
        }
    } elseif ($total_today_seconds > 0) {
        $improvement_type = 'positive';
        $improvement = 100;
    }
    
    echo json_encode([
        'success' => true,
        'total_today_seconds' => $total_today_seconds,
        'total_today_formatted' => format_seconds($total_today_seconds),
        'yesterday_seconds' => $yesterday_seconds,
        'yesterday_formatted' => format_seconds($yesterday_seconds),
        'improvement_percent' => round($improvement, 1),
        'improvement_type' => $improvement_type,
        'subjects' => $subjects
    ]);
    
} catch (Throwable $e) {
    echo json_encode([
        'success' => false,
        'error' => 'Failed to fetch daily study time: ' . $e->getMessage(),
        'trace' => $e->getTraceAsString()
    ]);
}


$conn->close();
?>
