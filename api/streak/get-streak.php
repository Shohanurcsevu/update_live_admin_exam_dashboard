<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

require_once '../subject/db_connect.php';

try {
    // Single record with ID 1
    $stmt = $conn->prepare("SELECT current_streak, longest_streak, last_activity_date FROM user_streaks WHERE id = 1");
    $stmt->execute();
    $result = $stmt->get_result()->fetch_assoc();

    if (!$result) {
        // Initialize if not exists
        $conn->query("INSERT INTO user_streaks (id, current_streak, longest_streak, last_activity_date) VALUES (1, 0, 0, NULL)");
        $result = [
            'current_streak' => 0,
            'longest_streak' => 0,
            'last_activity_date' => null
        ];
    }

    echo json_encode([
        'success' => true,
        'data' => [
            'current_streak' => intval($result['current_streak']),
            'longest_streak' => intval($result['longest_streak']),
            'last_activity_date' => $result['last_activity_date']
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
