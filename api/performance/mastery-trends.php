<?php
// FILE: api/performance/mastery-trends.php
require_once '../subject/db_connect.php';
header('Content-Type: application/json');

date_default_timezone_set('Asia/Dhaka');

$response = [
    'success' => true,
    'data' => [
        'subjects' => [],
        'insights' => [],
        'total_exams' => 0,
        'daily_stats' => [
            'exams_created' => [],
            'exams_taken' => [],
            'subjects_no_activity' => [],
            'uncompleted_exams' => []
        ]
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

// Get total exams count for the user
$total_count_sql = "SELECT COUNT(*) as total FROM performance";
$total_result = $conn->query($total_count_sql);
if ($total_result) {
    $response['data']['total_exams'] = intval($total_result->fetch_assoc()['total']);
}


$response['data']['subjects'] = $subjects;
$response['data']['insights'] = $insights;

// 3. AI Mentor: Identify weak topics for personalized recommendations
$mentor_advice = [];
foreach ($subjects as $subject) {
    $this_week = $subject['this_week'];
    $last_week = $subject['last_week'];
    
    // Only analyze subjects with recent activity and performance issues
    if ($this_week !== null && ($this_week < 70 || ($last_week !== null && ($this_week - $last_week) <= -10))) {
        // Find the weakest topic in this subject
        $weak_topic_sql = "
            SELECT 
                t.topic_name,
                AVG((p.score_with_negative / e.total_marks) * 100) as topic_accuracy,
                COUNT(p.id) as attempt_count
            FROM topics t
            JOIN exams e ON t.id = e.topic_id
            JOIN performance p ON e.id = p.exam_id
            JOIN subjects s ON e.subject_id = s.id
            WHERE s.subject_name = ?
            AND p.attempt_time >= DATE_SUB(CURRENT_DATE, INTERVAL 14 DAY)
            GROUP BY t.id, t.topic_name
            HAVING attempt_count >= 1
            ORDER BY topic_accuracy ASC
            LIMIT 1
        ";
        
        $stmt = $conn->prepare($weak_topic_sql);
        $stmt->bind_param("s", $subject['name']);
        $stmt->execute();
        $topic_result = $stmt->get_result();
        
        if ($topic_row = $topic_result->fetch_assoc()) {
            $mentor_advice[] = [
                'subject' => $subject['name'],
                'weak_topic' => $topic_row['topic_name'],
                'topic_accuracy' => round(floatval($topic_row['topic_accuracy']), 1),
                'current_accuracy' => $this_week,
                'priority' => $this_week < 60 ? 'high' : 'medium'
            ];
        }
    }
}

$response['data']['mentor_advice'] = $mentor_advice;

// --- DAILY EXAM STATUS TRACKING ---
// Get subjects with exams created today (or updated, as a proxy for creation)
$daily_exams_sql = "
    SELECT 
        s.id as subject_id,
        s.subject_name,
        COUNT(DISTINCT e.id) as created_count,
        COUNT(DISTINCT p.id) as taken_count
    FROM subjects s
    LEFT JOIN exams e ON s.id = e.subject_id AND DATE(e.updated_at) = CURRENT_DATE AND e.is_deleted = 0
    LEFT JOIN performance p ON e.id = p.exam_id AND DATE(p.attempt_time) = CURRENT_DATE
    WHERE s.is_deleted = 0
    GROUP BY s.id, s.subject_name
";

$daily_result = $conn->query($daily_exams_sql);
$exams_created = [];
$exams_taken = [];
$subjects_no_activity = [];

if ($daily_result) {
    while ($row = $daily_result->fetch_assoc()) {
        $created = (int)$row['created_count'];
        $taken = (int)$row['taken_count'];
        
        if ($created > 0) {
            $exams_created[] = [
                'id' => $row['subject_id'],
                'name' => $row['subject_name'],
                'count' => $created
            ];
            if ($taken > 0) {
                $exams_taken[] = [
                    'id' => $row['subject_id'],
                    'name' => $row['subject_name'],
                    'count' => $taken
                ];
            }
        } else {
            $subjects_no_activity[] = [
                'id' => $row['subject_id'],
                'name' => $row['subject_name']
            ];
        }
    }
}

$response['data']['daily_stats'] = [
    'exams_created' => $exams_created,
    'exams_taken' => $exams_taken,
    'subjects_no_activity' => $subjects_no_activity,
    'uncompleted_exams' => []
];

// --- GET SPECIFIC UNCOMPLETED EXAM TITLES ---
$uncompleted_sql = "
    SELECT e.id, e.exam_title, s.subject_name
    FROM exams e
    JOIN subjects s ON e.subject_id = s.id
    LEFT JOIN performance p ON e.id = p.exam_id AND DATE(p.attempt_time) = CURRENT_DATE
    WHERE DATE(e.updated_at) = CURRENT_DATE 
    AND e.is_deleted = 0
    AND p.id IS NULL
";

$uncompleted_result = $conn->query($uncompleted_sql);
if ($uncompleted_result) {
    while ($row = $uncompleted_result->fetch_assoc()) {
        $response['data']['daily_stats']['uncompleted_exams'][] = [
            'id' => $row['id'],
            'title' => $row['exam_title'],
            'subject' => $row['subject_name']
        ];
    }
}

echo json_encode($response);
$conn->close();
?>
