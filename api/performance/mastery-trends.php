<?php
// FILE: api/performance/mastery-trends.php
require_once '../subject/db_connect.php';
header('Content-Type: application/json');

date_default_timezone_set('Asia/Dhaka');

$response = [
    'success' => true,
    'data' => [
        'subjects' => [],
        'insights' => []
    ]
];

// Helper to calculate accuracy trends
// Period 1: Last 7 days
// Period 2: 7 to 14 days ago

$trends_sql = "
    SELECT 
        s.id as subject_id,
        s.subject_name,
        AVG(CASE WHEN p.attempt_time >= DATE_SUB(CURRENT_DATE, INTERVAL 7 DAY) THEN (p.score_with_negative / e.total_marks) * 100 END) as accuracy_this_week,
        AVG(CASE WHEN p.attempt_time >= DATE_SUB(CURRENT_DATE, INTERVAL 14 DAY) AND p.attempt_time < DATE_SUB(CURRENT_DATE, INTERVAL 7 DAY) THEN (p.score_with_negative / e.total_marks) * 100 END) as accuracy_last_week
    FROM subjects s
    LEFT JOIN performance p ON s.id = p.subject_id
    LEFT JOIN exams e ON p.exam_id = e.id
    GROUP BY s.id, s.subject_name
    LIMIT 10
";

$result = $conn->query($trends_sql);
$subjects = [];
$insights = [];

if ($result) {
    while ($row = $result->fetch_assoc()) {
        $this_week = $row['accuracy_this_week'] !== null ? round(floatval($row['accuracy_this_week']), 1) : null;
        $last_week = $row['accuracy_last_week'] !== null ? round(floatval($row['accuracy_last_week']), 1) : null;
        
        $subjects[] = [
            'name' => $row['subject_name'],
            'this_week' => $this_week,
            'last_week' => $last_week
        ];

        // Generate Insights
        if ($this_week !== null && $last_week !== null) {
            $diff = $this_week - $last_week;
            if ($diff <= -10) {
                $insights[] = [
                    'type' => 'warning',
                    'message' => "Your accuracy in **{$row['subject_name']}** has dropped by " . abs(round($diff)) . "% this week. Consider a review session!",
                    'subject' => $row['subject_name']
                ];
            } elseif ($diff >= 10) {
                $insights[] = [
                    'type' => 'improvement',
                    'message' => "Great job! Your **{$row['subject_name']}** mastery improved by " . round($diff) . "% compared to last week.",
                    'subject' => $row['subject_name']
                ];
            }
        }
    }
}

$response['data']['subjects'] = $subjects;
$response['data']['insights'] = $insights;

echo json_encode($response);
$conn->close();
?>
