<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

require_once '../subject/db_connect.php';

try {
    // Return last 91 days (13 weeks) of activity for heat calendar
    $days = isset($_GET['days']) ? intval($_GET['days']) : 91;
    $days = min($days, 365); // Cap at 1 year

    $stmt = $conn->prepare("
        SELECT activity_date, study_hours 
        FROM streak_activity_log 
        WHERE activity_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        ORDER BY activity_date ASC
    ");
    $stmt->bind_param("i", $days);
    $stmt->execute();
    $result = $stmt->get_result();

    $history = [];
    while ($row = $result->fetch_assoc()) {
        $history[] = [
            'date' => $row['activity_date'],
            'hours' => floatval($row['study_hours'])
        ];
    }

    echo json_encode([
        'success' => true,
        'data' => $history
    ]);

} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}

$conn->close();
?>
