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
                    WHEN p.time_used_seconds > 0 THEN CEIL(p.time_used_seconds / 60) * 60
                    ELSE 0 
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
                -- Only count full completions towards sessions count
                SUM(CASE 
                    WHEN al.activity_details IS NULL OR al.activity_details = '' THEN 1 -- Old logs
                    WHEN al.activity_details LIKE '%\"status\":\"completed\"%' THEN 1
                    WHEN al.activity_details NOT LIKE '%\"status\"%' THEN 1 -- Transition period logs
                    ELSE 0 
                END) as sessions,
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
        
        $subjects[$row['subject_name']] = [
            'subject_name' => $row['subject_name'],
            'subject_id' => $row['subject_id'] ? intval($row['subject_id']) : null,
            'seconds' => $seconds,
            'formatted' => format_seconds($seconds),
            'session_count' => intval($row['session_count'])
        ];
    }

    // --- Added: Merge Currently Active Focus Session ---
    $active_focus_sql = "
        SELECT 
            subject_name,
            subject_id,
            (duration_minutes * 60 - remaining_seconds) + (UNIX_TIMESTAMP(NOW()) - UNIX_TIMESTAMP(last_heartbeat)) as active_seconds
        FROM study_sessions
        WHERE status = 'active' AND session_type = 'focus'
        LIMIT 1
    ";
    $active_focus_res = $conn->query($active_focus_sql);
    if ($active_focus_res && $active_row = $active_focus_res->fetch_assoc()) {
        $name = $active_row['subject_name'];
        $active_sec = max(0, intval($active_row['active_seconds']));
        
        if (isset($subjects[$name])) {
            $subjects[$name]['seconds'] += $active_sec;
            $subjects[$name]['formatted'] = format_seconds($subjects[$name]['seconds']);
        } else {
            $subjects[$name] = [
                'subject_name' => $name,
                'subject_id' => $active_row['subject_id'] ? intval($active_row['subject_id']) : null,
                'seconds' => $active_sec,
                'formatted' => format_seconds($active_sec),
                'session_count' => 0 // Ongoing
            ];
        }
        $total_today_seconds += $active_sec;
    }

    $subjects = array_values($subjects);
    
    // Get yesterday's total for comparison (including Pomodoro sessions)
    $yesterday_sql = "
        SELECT 
            SUM(calculated_seconds) as total_seconds,
            SUM(total_questions) as total_questions
        FROM (
            SELECT 
                CASE 
                    WHEN p.time_used_seconds > 0 THEN CEIL(p.time_used_seconds / 60) * 60
                    ELSE 0 
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
    
    // Get last pomodoro session end and total break time since then
    $last_pomodoro_sql = "
        SELECT UNIX_TIMESTAMP(MAX(timestamp)) as last_end
        FROM activity_log
        WHERE activity_type = 'pomodoro_session'
    ";
    $last_pomodoro_result = $conn->query($last_pomodoro_sql);
    $last_pomodoro_end = 0;
    if ($last_row = $last_pomodoro_result->fetch_assoc()) {
        $last_pomodoro_end = intval($last_row['last_end'] ?? 0);
    }

    $break_seconds = 0;
    if ($last_pomodoro_end > 0) {
        $break_sql = "
            SELECT SUM(CAST(JSON_UNQUOTE(JSON_EXTRACT(activity_details, '$.duration')) AS DECIMAL) * 60) as total_break_seconds
            FROM activity_log
            WHERE activity_type = 'pomodoro_break'
            AND UNIX_TIMESTAMP(timestamp) > $last_pomodoro_end
        ";
        $break_result = $conn->query($break_sql);
        if ($break_row = $break_result->fetch_assoc()) {
            $break_seconds = intval($break_row['total_break_seconds'] ?? 0);
        }

        // Also subtract current active break if exists
        $active_break_sql = "
            SELECT 
                (duration_minutes * 60 - remaining_seconds) + (UNIX_TIMESTAMP(NOW()) - UNIX_TIMESTAMP(last_heartbeat)) as active_duration
            FROM study_sessions
            WHERE session_type = 'break' AND status = 'active'
            AND UNIX_TIMESTAMP(last_heartbeat) > $last_pomodoro_end
            LIMIT 1
        ";
        $active_break_res = $conn->query($active_break_sql);
        if ($active_row = $active_break_res->fetch_assoc()) {
            $break_seconds += intval($active_row['active_duration']);
        }
    }

    $now = time();
    $calc_idle_seconds = ($last_pomodoro_end > 0) ? max(0, $now - $last_pomodoro_end - $break_seconds) : 0;

    // --- Added: Fetch Absolute Last Activity Timestamp for Tracker Persistence ---
    $last_activity_sql = "
        SELECT MAX(last_time) as absolute_last_active
        FROM (
            SELECT MAX(attempt_time) as last_time FROM performance WHERE DATE(attempt_time) = CURRENT_DATE
            UNION ALL
            SELECT MAX(timestamp) as last_time FROM activity_log 
            WHERE DATE(timestamp) = CURRENT_DATE 
            AND (activity_type LIKE '%Exam%' OR activity_type LIKE '%pomodoro%' OR activity_type LIKE '%Subject%')
            UNION ALL
            SELECT MAX(last_heartbeat) as last_time FROM study_sessions 
            WHERE status = 'active' AND session_type = 'focus'
        ) combined_last
    ";
    $last_activity_res = $conn->query($last_activity_sql);
    $last_activity_row = $last_activity_res->fetch_assoc();
    $last_active_timestamp = $last_activity_row['absolute_last_active'] ? strtotime($last_activity_row['absolute_last_active']) * 1000 : null;

    echo json_encode([
        'success' => true,
        'total_today_seconds' => $total_today_seconds,
        'total_today_formatted' => format_seconds($total_today_seconds),
        'yesterday_seconds' => $yesterday_seconds,
        'yesterday_formatted' => format_seconds($yesterday_seconds),
        'improvement_percent' => round($improvement, 1),
        'improvement_type' => $improvement_type,
        'subjects' => $subjects,
        'calc_idle_seconds' => $calc_idle_seconds,
        'last_active_timestamp' => $last_active_timestamp,
        'server_time' => $now
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
