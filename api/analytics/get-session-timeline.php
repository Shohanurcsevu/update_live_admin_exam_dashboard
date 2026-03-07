<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

require_once '../subject/db_connect.php';

date_default_timezone_set('Asia/Dhaka');

try {
    // Get individual session blocks for today's 24h timeline
    // Each block has: start_time (hour decimal), duration_hours, subject, type
    $sql = "
        SELECT 
            start_hour,
            duration_hours,
            subject_name,
            session_type,
            subject_id
        FROM (
            -- Exam sessions: attempt_time is the END time, so start = attempt_time - duration
            SELECT 
                (HOUR(p.attempt_time) + MINUTE(p.attempt_time)/60.0) 
                    - (CASE WHEN p.time_used_seconds > 0 THEN p.time_used_seconds/3600.0 ELSE 0 END) as start_hour,
                CASE 
                    WHEN p.time_used_seconds > 0 THEN p.time_used_seconds / 3600.0 
                    ELSE (SELECT COUNT(*) FROM questions q WHERE q.exam_id = e.id AND q.is_deleted = 0) / 60.0
                END as duration_hours,
                s.subject_name,
                'exam' as session_type,
                s.id as subject_id
            FROM performance p
            JOIN exams e ON p.exam_id = e.id
            JOIN subjects s ON e.subject_id = s.id
            WHERE DATE(p.attempt_time) = CURRENT_DATE
            AND p.time_used_seconds > 0

            UNION ALL

            -- Pomodoro sessions: timestamp is the END time, duration from JSON
            SELECT 
                (HOUR(al.timestamp) + MINUTE(al.timestamp)/60.0) 
                    - (CASE 
                        WHEN al.activity_details LIKE '%duration%'
                        THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(al.activity_details, '$.duration')) AS DECIMAL) / 60.0 
                        ELSE 25.0/60.0 
                    END) as start_hour,
                CASE 
                    WHEN al.activity_details LIKE '%duration%'
                    THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(al.activity_details, '$.duration')) AS DECIMAL) / 60.0
                    ELSE 25.0/60.0
                END as duration_hours,
                al.activity_message as subject_name,
                'pomodoro' as session_type,
                s.id as subject_id
            FROM activity_log al
            LEFT JOIN subjects s ON al.activity_message = s.subject_name
            WHERE al.activity_type = 'pomodoro_session'
            AND DATE(al.timestamp) = CURRENT_DATE
        ) timeline
        ORDER BY start_hour ASC
    ";

    $result = $conn->query($sql);
    if (!$result) {
        throw new Exception("Timeline query failed: " . $conn->error);
    }

    $sessions = [];
    while ($row = $result->fetch_assoc()) {
        $start = max(0, floatval($row['start_hour']));
        $duration = max(0.01, floatval($row['duration_hours'])); // Min 0.01h to be visible

        $sessions[] = [
            'start_hour' => round($start, 3),
            'duration_hours' => round($duration, 3),
            'subject' => $row['subject_name'],
            'type' => $row['session_type'],
            'subject_id' => $row['subject_id'] ? intval($row['subject_id']) : null
        ];
    }

    echo json_encode([
        'success' => true,
        'sessions' => $sessions,
        'current_hour' => round(date('G') + date('i')/60.0, 3)
    ]);

} catch (Throwable $e) {
    echo json_encode([
        'success' => false,
        'error' => 'Failed to fetch session timeline: ' . $e->getMessage()
    ]);
}

$conn->close();
?>
