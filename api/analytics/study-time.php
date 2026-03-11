<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

require_once '../subject/db_connect.php';

date_default_timezone_set('Asia/Dhaka');

$range = isset($_GET['range']) ? $_GET['range'] : 'week';

// Define date ranges
$current_start = '';
$current_end = date('Y-m-d H:i:s');
$prev_start = '';
$prev_end = '';

switch ($range) {
    case 'today':
        $now = time();
        $hour = intval(date('G', $now));
        
        // Logical today starts at 5 AM
        if ($hour < 5) {
            $study_date = date('Y-m-d', strtotime('-1 day'));
        } else {
            $study_date = date('Y-m-d');
        }
        
        $current_start = $study_date . ' 05:00:00';
        $prev_start = date('Y-m-d', strtotime($study_date . ' -1 day')) . ' 05:00:00';
        $prev_end = date('Y-m-d H:i:s', strtotime($current_start . ' -1 second'));
        break;
    case 'week':
        $current_start = date('Y-m-d H:i:s', strtotime('-7 days'));
        $prev_start = date('Y-m-d H:i:s', strtotime('-14 days'));
        $prev_end = $current_start;
        break;
    case 'month':
        $current_start = date('Y-m-d H:i:s', strtotime('-30 days'));
        $prev_start = date('Y-m-d H:i:s', strtotime('-60 days'));
        $prev_end = $current_start;
        break;
    case 'last_month':
        $current_start = date('Y-m-01 00:00:00', strtotime('first day of last month'));
        $current_end = date('Y-m-t 23:59:59', strtotime('last day of last month'));
        $prev_start = date('Y-m-01 00:00:00', strtotime('first day of -2 month'));
        $prev_end = date('Y-m-t 23:59:59', strtotime('last day of -2 month'));
        break;
    case 'year':
        $current_start = date('Y-m-d H:i:s', strtotime('-365 days'));
        $prev_start = date('Y-m-d H:i:s', strtotime('-730 days'));
        $prev_end = $current_start;
        break;
    default:
        $range = 'week';
        $current_start = date('Y-m-d H:i:s', strtotime('-7 days'));
        $prev_start = date('Y-m-d H:i:s', strtotime('-14 days'));
        $prev_end = $current_start;
}

function getPeriodStats($conn, $start, $end) {
    $sql = "
        SELECT 
            subject_name,
            subject_id,
            SUM(calculated_seconds) as total_seconds,
            SUM(exam_seconds) as exam_seconds,
            SUM(pomo_seconds) as pomo_seconds,
            SUM(exam_count) as exam_count,
            SUM(pomo_count) as pomo_count,
            SUM(questions) as total_questions
        FROM (
            -- Exams
            SELECT 
                s.subject_name,
                s.id as subject_id,
                CASE 
                    WHEN p.time_used_seconds > 0 THEN p.time_used_seconds 
                    ELSE (SELECT COUNT(*) FROM questions q WHERE q.exam_id = e.id AND q.is_deleted = 0) * 60 
                END as calculated_seconds,
                p.time_used_seconds as exam_seconds,
                0 as pomo_seconds,
                1 as exam_count,
                0 as pomo_count,
                (SELECT COUNT(*) FROM questions q WHERE q.exam_id = e.id AND q.is_deleted = 0) as questions
            FROM performance p
            JOIN exams e ON p.exam_id = e.id
            JOIN subjects s ON e.subject_id = s.id
            WHERE p.attempt_time BETWEEN ? AND ?

            UNION ALL

            -- Pomodoro
            SELECT 
                al.activity_message as subject_name,
                s.id as subject_id,
                SUM(CASE 
                    WHEN al.activity_details LIKE '%duration%'
                    THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(al.activity_details, '$.duration')) AS DECIMAL) * 60 
                    ELSE 25 * 60 
                END) as calculated_seconds,
                0 as exam_seconds,
                SUM(CASE 
                    WHEN al.activity_details LIKE '%duration%'
                    THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(al.activity_details, '$.duration')) AS DECIMAL) * 60 
                    ELSE 25 * 60 
                END) as pomo_seconds,
                0 as exam_count,
                COUNT(*) as pomo_count,
                0 as questions
            FROM activity_log al
            LEFT JOIN subjects s ON al.activity_message = s.subject_name
            WHERE al.activity_type = 'pomodoro_session'
            AND al.timestamp BETWEEN ? AND ?
            GROUP BY al.activity_message, s.id
        ) combined
        GROUP BY subject_id, subject_name
    ";

    $stmt = $conn->prepare($sql);
    $stmt->bind_param("ssss", $start, $end, $start, $end);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $stats = [
        'total_seconds' => 0,
        'exam_seconds' => 0,
        'pomo_seconds' => 0,
        'exam_count' => 0,
        'session_count' => 0,
        'subjects' => []
    ];

    while ($row = $result->fetch_assoc()) {
        $sec = floatval($row['total_seconds']);
        // Correction for exams with 0 time in outer sum (already handled in subquery but safety check)
        
        $stats['total_seconds'] += $sec;
        $stats['exam_seconds'] += floatval($row['exam_seconds']);
        $stats['pomo_seconds'] += floatval($row['pomo_seconds']);
        $stats['exam_count'] += intval($row['exam_count']);
        $stats['session_count'] += intval($row['pomo_count']);
        
        $stats['subjects'][$row['subject_name']] = [
            'seconds' => $sec,
            'subject' => $row['subject_name'],
            'subject_id' => $row['subject_id'] // Add subject_id
        ];
    }
    
    return $stats;
}

try {
    $current = getPeriodStats($conn, $current_start, $current_end);
    $previous = getPeriodStats($conn, $prev_start, $prev_end);

    // Calculate overall trend
    $diff = $current['total_seconds'] - $previous['total_seconds'];
    $pct = $previous['total_seconds'] > 0 ? ($diff / $previous['total_seconds']) * 100 : 0;
    
    $trend = 'neutral';
    if ($pct > 5) $trend = 'improving';
    else if ($pct < -5) $trend = 'declining';

    if ($previous['total_seconds'] == 0 && $current['total_seconds'] > 0) {
        $trend = 'improving';
        $pct = 100;
    }

    // Breakdown with trends
    $breakdown = [];
    foreach ($current['subjects'] as $subject => $data) {
        $prev_sec = isset($previous['subjects'][$subject]) ? $previous['subjects'][$subject]['seconds'] : 0;
        $s_diff = $data['seconds'] - $prev_sec;
        $s_pct = $prev_sec > 0 ? ($s_diff / $prev_sec) * 100 : 0;
        
        $s_trend = 'neutral';
        if ($s_pct > 5) $s_trend = 'improving';
        else if ($s_pct < -5) $s_trend = 'declining';
        
        if ($prev_sec == 0 && $data['seconds'] > 0) {
            $s_trend = 'improving';
            $s_pct = 100;
        }

        $breakdown[] = [
            'subject' => $subject,
            'subject_id' => $data['subject_id'], // Pass subject_id to response
            'seconds' => $data['seconds'],
            'percent_change' => round(abs($s_pct), 1),
            'trend' => $s_trend
        ];
    }

    // Sort breakdown by seconds desc
    usort($breakdown, function($a, $b) {
        return $b['seconds'] - $a['seconds'];
    });

    $total_sessions = $current['exam_count'] + $current['session_count'];
    $avg_session_mins = $total_sessions > 0 ? round(($current['total_seconds'] / $total_sessions) / 60) : 0;

    echo json_encode([
        'success' => true,
        'data' => [
            'total_seconds' => $current['total_seconds'],
            'percent_change' => round(abs($pct), 1),
            'trend' => $trend,
            'activity_stats' => [
                'exam_count' => $current['exam_count'],
                'session_count' => $current['session_count'],
                'avg_session_mins' => $avg_session_mins
            ],
            'source_breakdown' => [
                'exam_seconds' => $current['exam_seconds'],
                'session_seconds' => $current['pomo_seconds']
            ],
            'breakdown' => $breakdown
        ]
    ]);

} catch (Throwable $e) {
    echo json_encode([
        'success' => false,
        'error' => 'Failed to fetch analytics: ' . $e->getMessage()
    ]);
}

$conn->close();
?>

