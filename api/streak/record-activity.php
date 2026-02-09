<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

require_once '../subject/db_connect.php';

date_default_timezone_set('Asia/Dhaka');

try {
    $today = date('Y-m-d');

    // Get current streak info (single record ID 1)
    $stmt = $conn->prepare("SELECT current_streak, longest_streak, last_activity_date FROM user_streaks WHERE id = 1");
    $stmt->execute();
    $result = $stmt->get_result()->fetch_assoc();

    if (!$result) {
        // First record
        $stmt = $conn->prepare("INSERT INTO user_streaks (id, current_streak, longest_streak, last_activity_date) VALUES (1, 1, 1, ?)");
        $stmt->bind_param("s", $today);
        $stmt->execute();
        $new_streak = 1;
        $is_new_day = true;
    } else {
        $last_date = $result['last_activity_date'];
        $current_streak = intval($result['current_streak']);
        $longest_streak = intval($result['longest_streak']);

        if ($last_date === $today) {
            // Already recorded today
            $new_streak = $current_streak;
            $is_new_day = false;
        } else {
            $yesterday = date('Y-m-d', strtotime('-1 day'));
            
            if ($last_date === $yesterday) {
                // Continued streak
                $new_streak = $current_streak + 1;
            } else {
                // Streak broken or reset
                $new_streak = 1;
            }

            $new_longest = max($new_streak, $longest_streak);
            
            $stmt = $conn->prepare("UPDATE user_streaks SET current_streak = ?, longest_streak = ?, last_activity_date = ? WHERE id = 1");
            $stmt->bind_param("iis", $new_streak, $new_longest, $today);
            $stmt->execute();
            $is_new_day = true;
        }
    }

    echo json_encode([
        'success' => true,
        'data' => [
            'current_streak' => $new_streak,
            'is_new_day' => $is_new_day
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
