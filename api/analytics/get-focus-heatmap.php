<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

require_once '../subject/db_connect.php';

date_default_timezone_set('Asia/Dhaka');

try {
    // Build a 7-day × 24-hour grid of study minutes
    // Returns: { grid: [[0..23], ...7 days], days: ["Sat","Sun",...], peak_hour: 14 }
    // Uses 5 AM logical day: DATE_SUB(ts, INTERVAL 5 HOUR) shifts timestamps
    // so midnight-4:59 AM maps to the previous logical day.

    // Calculate the logical "today" date (rolls back if before 5 AM)
    $hour = intval(date('G'));
    if ($hour < 5) {
        $logicalToday = date('Y-m-d', strtotime('yesterday'));
    } else {
        $logicalToday = date('Y-m-d');
    }
    // Logical start = 7 days ago at 5:00 AM
    $logicalStart = date('Y-m-d', strtotime($logicalToday . ' -6 days')) . ' 05:00:00';

    $sql = "
        SELECT 
            DATE(DATE_SUB(ts, INTERVAL 5 HOUR)) as study_date,
            HOUR(ts) as study_hour,
            SUM(duration_sec) / 60.0 as total_minutes
        FROM (
            -- Exam sessions: spread duration into the start hour
            SELECT 
                DATE_SUB(p.attempt_time, INTERVAL p.time_used_seconds SECOND) as ts,
                p.time_used_seconds as duration_sec
            FROM performance p
            WHERE p.time_used_seconds > 0
            AND p.attempt_time >= '{$logicalStart}'

            UNION ALL

            -- Pomodoro sessions
            SELECT 
                DATE_SUB(al.timestamp, INTERVAL 
                    CASE 
                        WHEN al.activity_details LIKE '%duration%'
                        THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(al.activity_details, '$.duration')) AS DECIMAL)
                        ELSE 25
                    END MINUTE
                ) as ts,
                CASE 
                    WHEN al.activity_details LIKE '%duration%'
                    THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(al.activity_details, '$.duration')) AS DECIMAL) * 60
                    ELSE 25 * 60
                END as duration_sec
            FROM activity_log al
            WHERE al.activity_type = 'pomodoro_session'
            AND al.timestamp >= '{$logicalStart}'
        ) sessions
        GROUP BY study_date, study_hour
        ORDER BY study_date ASC, study_hour ASC
    ";

    $result = $conn->query($sql);
    if (!$result) {
        throw new Exception("Heatmap query failed: " . $conn->error);
    }

    // Initialize 7-day grid using LOGICAL dates (5 AM rollover)
    $grid = [];
    $days = [];
    for ($i = 6; $i >= 0; $i--) {
        $date = date('Y-m-d', strtotime($logicalToday . " -{$i} days"));
        $dayName = date('D', strtotime($logicalToday . " -{$i} days")); // Mon, Tue, etc.
        $days[] = $dayName;
        $grid[$date] = array_fill(0, 24, 0);
    }

    $peakMinutes = 0;
    while ($row = $result->fetch_assoc()) {
        $date = $row['study_date'];
        $hour = intval($row['study_hour']);
        $mins = round(floatval($row['total_minutes']), 1);

        if (isset($grid[$date])) {
            $grid[$date][$hour] = $mins;
            if ($mins > $peakMinutes) $peakMinutes = $mins;
        }
    }

    // Convert to indexed array (0-6)
    $gridArray = array_values($grid);

    // Find peak hour (most total minutes across all 7 days)
    $hourTotals = array_fill(0, 24, 0);
    foreach ($gridArray as $dayData) {
        for ($h = 0; $h < 24; $h++) {
            $hourTotals[$h] += $dayData[$h];
        }
    }
    $peakHour = array_search(max($hourTotals), $hourTotals);

    echo json_encode([
        'success' => true,
        'grid' => $gridArray,
        'days' => $days,
        'peak_hour' => $peakHour,
        'peak_minutes' => $peakMinutes,
        'total_week_minutes' => round(array_sum($hourTotals), 1)
    ]);

} catch (Throwable $e) {
    echo json_encode([
        'success' => false,
        'error' => 'Failed to fetch heatmap: ' . $e->getMessage()
    ]);
}

$conn->close();
?>
