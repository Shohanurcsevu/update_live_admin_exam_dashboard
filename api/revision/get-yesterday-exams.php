<?php
// FILE: api/revision/get-yesterday-exams.php
require_once '../subject/db_connect.php';
header('Content-Type: application/json');

date_default_timezone_set('Asia/Dhaka');
$yesterday = date('Y-m-d', strtotime('-1 day'));
$yesterday_start = $yesterday . ' 00:00:00';
$yesterday_end = $yesterday . ' 23:59:59';
$today = date('Y-m-d');
$today_start = $today . ' 00:00:00';
$today_end = $today . ' 23:59:59';

$response = [
    'success' => true,
    'data' => [
        'yesterday_exams' => []
    ]
];

// Get all exams created yesterday, grouped by subject
$yesterday_exams_sql = "
    SELECT 
        e.id,
        e.exam_title,
        e.total_marks,
        s.id as subject_id,
        s.subject_name,
        COUNT(DISTINCT p.id) as attempt_count,
        MAX(p.score_with_negative) as best_score,
        MAX(CASE WHEN p.attempt_time BETWEEN '$today_start' AND '$today_end' THEN 1 ELSE 0 END) as taken_today
    FROM exams e
    JOIN subjects s ON e.subject_id = s.id
    LEFT JOIN performance p ON e.id = p.exam_id
    WHERE e.created_at BETWEEN '$yesterday_start' AND '$yesterday_end'
        AND e.is_deleted = 0
        AND e.is_revision = 0
        AND s.is_deleted = 0
    GROUP BY e.id, e.exam_title, e.total_marks, s.id, s.subject_name
    ORDER BY s.subject_name, e.exam_title
";

$result = $conn->query($yesterday_exams_sql);

if ($result) {
    $subjects_map = [];
    
    while ($row = $result->fetch_assoc()) {
        $subject_id = $row['subject_id'];
        $subject_name = $row['subject_name'];
        
        // Initialize subject if not exists
        if (!isset($subjects_map[$subject_id])) {
            $subjects_map[$subject_id] = [
                'subject_id' => $subject_id,
                'subject_name' => $subject_name,
                'exams' => []
            ];
        }
        
        // Add exam to subject
        $subjects_map[$subject_id]['exams'][] = [
            'id' => $row['id'],
            'title' => $row['exam_title'],
            'total_marks' => $row['total_marks'],
            'attempt_count' => intval($row['attempt_count']),
            'best_score' => $row['best_score'] !== null ? floatval($row['best_score']) : null,
            'is_completed' => intval($row['attempt_count']) > 0,
            'taken_today' => intval($row['taken_today']) === 1
        ];
    }
    
    // Convert map to array
    $response['data']['yesterday_exams'] = array_values($subjects_map);
}

echo json_encode($response);
$conn->close();
?>
