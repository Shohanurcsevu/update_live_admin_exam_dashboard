<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

require_once '../subject/db_connect.php';

date_default_timezone_set('Asia/Dhaka');

// --- Configuration ---
$DAILY_TARGET_HOURS = 12;
$DAILY_TARGET_SECONDS = $DAILY_TARGET_HOURS * 3600;
$BUFFER_MULTIPLIER = 1.1; // 10% buffer for breaks/transitions

// Helper to get study date (rollover at 5 AM)
function get_study_date() {
    $now = time();
    $hour = intval(date('G', $now));
    if ($hour < 5) {
        return date('Y-m-d', strtotime('yesterday'));
    }
    return date('Y-m-d', $now);
}

$study_date = get_study_date();
$next_date = date('Y-m-d', strtotime($study_date . ' +1 day'));

// Logical day boundaries (5 AM to 5 AM)
$start_ts = $study_date . ' 05:00:00';
$end_ts = $next_date . ' 05:00:00';

// Get Pace Multiplier from request (default 1.0)
$pace_multiplier = isset($_GET['pace']) ? floatval($_GET['pace']) : 1.0;
if ($pace_multiplier <= 0) $pace_multiplier = 1.0; // Prevent division by zero

try {
    // 1. Calculate Total Study Time Today (Exact COPY of logic from daily-study-time.php)
    // We need to calculate studied_seconds again because we can't easily import it from another endpoint without refactoring
    $today_sql = "
        SELECT 
            SUM(calculated_seconds) as total_seconds
        FROM (
            -- Exam Performance
            SELECT 
                CASE 
                    WHEN p.time_used_seconds > 0 THEN CEIL(p.time_used_seconds / 60) * 60
                    ELSE 0 
                END as calculated_seconds
            FROM performance p
            JOIN exams e ON p.exam_id = e.id
            JOIN subjects s ON e.subject_id = s.id
            WHERE p.attempt_time BETWEEN '$start_ts' AND '$end_ts'

            UNION ALL

            -- Pomodoro Sessions (Mission Board)
            SELECT 
                SUM(CASE 
                    WHEN al.activity_details LIKE '%duration%'
                    THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(al.activity_details, '$.duration')) AS DECIMAL) * 60 
                    ELSE 25 * 60 
                END) as calculated_seconds
            FROM activity_log al
            LEFT JOIN subjects s ON al.activity_message = s.subject_name
            WHERE al.activity_type = 'pomodoro_session'
            AND al.timestamp BETWEEN '$start_ts' AND '$end_ts'
        ) combined
    ";
    
    $result = $conn->query($today_sql);
    if (!$result) {
        throw new Exception("Query failed: " . $conn->error);
    }

    $row = $result->fetch_assoc();
    $studied_seconds = floatval($row['total_seconds'] ?? 0);

    // 2. Calculate Remaining Time
    $remaining_seconds = max(0, $DAILY_TARGET_SECONDS - $studied_seconds);

    // If goal reached
    if ($remaining_seconds <= 0) {
        echo json_encode([
            'success' => true,
            'is_finished' => true,
            'formatted_time' => "Goal Reached! 🎉",
            'server_time' => date('h:i A')
        ]);
        exit;
    }

    // 3. Apply Multiplier and Buffer
    // Formula: (Remaining / Speed) * Buffer
    // Examples:
    // - 10h remaining / 1.0 speed * 1.1 buffer = 11h real time needed
    // - 10h remaining / 2.0 speed * 1.1 buffer = 5.5h real time needed
    
    // Safety clamp on multiplier (0.1x to 5.0x)
    $pace_multiplier = max(0.1, min(5.0, $pace_multiplier));

    $simulated_duration = ($remaining_seconds / $pace_multiplier) * $BUFFER_MULTIPLIER;
    
    // 4. Calculate Finish Time
    $current_time = time();
    $finish_timestamp = $current_time + $simulated_duration;
    
    // 5. Format Output
    $formatted_time = date('h:i A', $finish_timestamp); // e.g., "05:30 PM"
    
    echo json_encode([
        'success' => true,
        'studied_seconds' => $studied_seconds,
        'remaining_seconds' => $remaining_seconds,
        'pace_multiplier' => $pace_multiplier,
        'simulated_duration' => $simulated_duration,
        'finish_timestamp' => $finish_timestamp, // Can stay as unix timestamp if frontend needs it
        'formatted_time' => $formatted_time, // This is the gold standard for display
        'is_finished' => false,
        'server_time' => date('h:i A'),
        'timezone' => date_default_timezone_get()
    ]);

} catch (Throwable $e) {
    echo json_encode([
        'success' => false,
        'error' => 'Calculation failed: ' . $e->getMessage()
    ]);
}

$conn->close();
?>
