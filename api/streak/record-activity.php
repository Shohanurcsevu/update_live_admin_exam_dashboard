<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

require_once '../subject/db_connect.php';

date_default_timezone_set('Asia/Dhaka');

try {
    // Use 5 AM as the logical day boundary (matches dashboard's TIMELINE_START_HOUR)
    // Activity before 5 AM counts as the previous logical day
    $now = new DateTime('now', new DateTimeZone('Asia/Dhaka'));
    if ((int)$now->format('H') < 5) {
        $now->modify('-1 day');
    }
    $today = $now->format('Y-m-d');

    // Get current streak info (single record ID 1)
    $stmt = $conn->prepare("SELECT current_streak, longest_streak, last_activity_date, freeze_available, last_freeze_date, freeze_used_count FROM user_streaks WHERE id = 1");
    $stmt->execute();
    $result = $stmt->get_result()->fetch_assoc();

    if (!$result) {
        // First record
        $stmt = $conn->prepare("INSERT INTO user_streaks (id, current_streak, longest_streak, last_activity_date, freeze_available) VALUES (1, 1, 1, ?, 1)");
        $stmt->bind_param("s", $today);
        $stmt->execute();
        $new_streak = 1;
        $is_new_day = true;
        $freeze_used = false;
        $freeze_available = 1;
    } else {
        $last_date = $result['last_activity_date'];
        $current_streak = intval($result['current_streak']);
        $longest_streak = intval($result['longest_streak']);
        $freeze_available = intval($result['freeze_available']);
        $last_freeze_date = $result['last_freeze_date'];
        $freeze_used_count = intval($result['freeze_used_count']);
        $freeze_used = false;

        // Reset freeze every Monday (weekly refresh)
        $dayOfWeek = (int)$now->format('N'); // 1=Mon, 7=Sun
        if ($dayOfWeek === 1 && $last_freeze_date !== $today) {
            // It's Monday and we haven't already refreshed today
            $lastFreezeDay = $last_freeze_date ? new DateTime($last_freeze_date) : null;
            $isFreshWeek = !$lastFreezeDay || $lastFreezeDay->format('W') !== $now->format('W');
            if ($isFreshWeek) {
                $freeze_available = 1;
            }
        }

        if ($last_date === $today) {
            // Already recorded today
            $new_streak = $current_streak;
            $is_new_day = false;
        } else {
            // Logical yesterday = logical today - 1 day
            $yesterdayDT = clone $now;
            $yesterdayDT->modify('-1 day');
            $yesterday = $yesterdayDT->format('Y-m-d');

            // Day before yesterday (for freeze detection)
            $dayBeforeYesterdayDT = clone $now;
            $dayBeforeYesterdayDT->modify('-2 days');
            $dayBeforeYesterday = $dayBeforeYesterdayDT->format('Y-m-d');
            
            if ($last_date === $yesterday) {
                // Continued streak (no gap)
                $new_streak = $current_streak + 1;
            } else if ($last_date === $dayBeforeYesterday && $freeze_available > 0) {
                // Missed exactly 1 day — use freeze to preserve streak
                $new_streak = $current_streak + 1; // Continue as if no break
                $freeze_available = 0;
                $freeze_used = true;
                $freeze_used_count++;
            } else {
                // Streak broken (gap too large or no freeze available)
                $new_streak = 1;
            }

            $new_longest = max($new_streak, $longest_streak);
            
            $stmt = $conn->prepare("UPDATE user_streaks SET current_streak = ?, longest_streak = ?, last_activity_date = ?, freeze_available = ?, last_freeze_date = ?, freeze_used_count = ? WHERE id = 1");
            $freeze_date_to_save = $freeze_used ? $today : $last_freeze_date;
            $stmt->bind_param("iissis", $new_streak, $new_longest, $today, $freeze_available, $freeze_date_to_save, $freeze_used_count);
            $stmt->execute();
            $is_new_day = true;
        }
    }

    // Also log to streak_activity_log for heat calendar (idempotent)
    $conn->query("INSERT IGNORE INTO streak_activity_log (activity_date, study_hours) VALUES ('$today', 0)");

    echo json_encode([
        'success' => true,
        'data' => [
            'current_streak' => $new_streak,
            'is_new_day' => $is_new_day,
            'freeze_used' => $freeze_used,
            'freeze_available' => $freeze_available
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
