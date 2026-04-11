<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

require_once '../subject/db_connect.php';

date_default_timezone_set('Asia/Dhaka');

try {
    // Single record with ID 1
    $stmt = $conn->prepare("SELECT current_streak, longest_streak, last_activity_date, freeze_available, last_freeze_date, freeze_used_count FROM user_streaks WHERE id = 1");
    $stmt->execute();
    $result = $stmt->get_result()->fetch_assoc();

    if (!$result) {
        // Initialize if not exists
        $conn->query("INSERT INTO user_streaks (id, current_streak, longest_streak, last_activity_date, freeze_available) VALUES (1, 0, 0, NULL, 1)");
        $result = [
            'current_streak' => 0,
            'longest_streak' => 0,
            'last_activity_date' => null,
            'freeze_available' => 1,
            'last_freeze_date' => null,
            'freeze_used_count' => 0
        ];
    } else {
        // --- STREAK VALIDATION LOGIC ---
        $last_date = $result['last_activity_date'];
        
        if ($last_date) {
            $now = new DateTime('now', new DateTimeZone('Asia/Dhaka'));
            if ((int)$now->format('H') < 5) {
                $now->modify('-1 day');
            }
            $today = $now->format('Y-m-d');
            
            $yesterdayDT = clone $now;
            $yesterdayDT->modify('-1 day');
            $yesterday = $yesterdayDT->format('Y-m-d');

            $dayBeforeYesterdayDT = clone $now;
            $dayBeforeYesterdayDT->modify('-2 days');
            $dayBeforeYesterday = $dayBeforeYesterdayDT->format('Y-m-d');

            $current_streak = intval($result['current_streak']);
            $freeze_available = intval($result['freeze_available'] ?? 1);
            $is_broken = false;

            if ($last_date !== $today && $last_date !== $yesterday) {
                // Gap detected
                if ($last_date === $dayBeforeYesterday && $freeze_available > 0) {
                    // Missed exactly 1 day (yesterday) but have a freeze available
                    // Streak is "At Risk" for today, but NOT broken yet
                    $is_broken = false;
                } else {
                    // Gap too large or no freeze
                    $is_broken = true;
                }
            }

            if ($is_broken && $current_streak > 0) {
                // Reset in database
                $updateStmt = $conn->prepare("UPDATE user_streaks SET current_streak = 0 WHERE id = 1");
                $updateStmt->execute();
                $result['current_streak'] = 0;
            }
        }
    }

    echo json_encode([
        'success' => true,
        'data' => [
            'current_streak' => intval($result['current_streak']),
            'longest_streak' => intval($result['longest_streak']),
            'last_activity_date' => $result['last_activity_date'],
            'freeze_available' => intval($result['freeze_available'] ?? 1),
            'last_freeze_date' => $result['last_freeze_date'] ?? null,
            'freeze_used_count' => intval($result['freeze_used_count'] ?? 0)
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
