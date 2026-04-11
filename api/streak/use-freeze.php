<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

require_once '../subject/db_connect.php';

date_default_timezone_set('Asia/Dhaka');

try {
    // 1. Calculate logical day
    $now = new DateTime('now', new DateTimeZone('Asia/Dhaka'));
    if ((int)$now->format('H') < 5) {
        $now->modify('-1 day');
    }
    $today = $now->format('Y-m-d');

    // 2. Check freeze availability
    $stmt = $conn->prepare("SELECT current_streak, freeze_available, freeze_used_count FROM user_streaks WHERE id = 1");
    $stmt->execute();
    $result = $stmt->get_result()->fetch_assoc();

    if (!$result) {
        throw new Exception("Streak record not found.");
    }

    $current_streak = intval($result['current_streak']);
    $freeze_available = intval($result['freeze_available']);
    $freeze_used_count = intval($result['freeze_used_count']);

    if ($freeze_available <= 0) {
        throw new Exception("No freeze available this week.");
    }

    // 3. Update database
    // Set last_activity_date to today, consume freeze
    $stmt = $conn->prepare("UPDATE user_streaks SET last_activity_date = ?, freeze_available = 0, last_freeze_date = ?, freeze_used_count = ? WHERE id = 1");
    $new_freeze_count = $freeze_used_count + 1;
    $stmt->bind_param("ssi", $today, $today, $new_freeze_count);
    $stmt->execute();

    // 4. Also log to activity log so it shows in the heat calendar
    $conn->query("INSERT IGNORE INTO streak_activity_log (activity_date, study_hours) VALUES ('$today', 0)");

    echo json_encode([
        'success' => true,
        'data' => [
            'current_streak' => $current_streak,
            'freeze_available' => 0,
            'freeze_used_count' => $new_freeze_count,
            'last_activity_date' => $today
        ]
    ]);

} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}

$conn->close();
?>
