<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

require_once '../subject/db_connect.php';

// Get daily exam counts for activity heatmap (last 12 months)

try {
    $sql = "
        SELECT 
            DATE(attempt_time) as date,
            COUNT(*) as exam_count
        FROM performance
        WHERE attempt_time >= DATE_SUB(CURRENT_DATE, INTERVAL 12 MONTH)
        GROUP BY DATE(attempt_time)
        ORDER BY date ASC
    ";
    
    $result = $conn->query($sql);
    
    $data = [];
    while ($row = $result->fetch_assoc()) {
        $data[] = [
            'date' => $row['date'],
            'exam_count' => intval($row['exam_count'])
        ];
    }
    
    echo json_encode([
        'success' => true,
        'data' => $data,
        'total_days' => count($data)
    ]);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => 'Failed to fetch activity data: ' . $e->getMessage()
    ]);
}

$conn->close();
?>
