<?php
// FILE: api/performance/study-discipline.php
require_once '../subject/db_connect.php';
header('Content-Type: application/json');

date_default_timezone_set('Asia/Dhaka');

$response = [
    'success' => true,
    'data' => [
        'streak' => 0,
        'activity' => []
    ]
];

// 1. Calculate General Study Streak from performance table
// We look at consecutive days with at least one exam attempt
$streak_sql = "
    WITH RECURSIVE Dates AS (
        SELECT DISTINCT DATE(attempt_time) as study_date
        FROM performance
        ORDER BY study_date DESC
    ),
    ConsecutiveDays AS (
        SELECT study_date, 
               DATE_SUB(study_date, INTERVAL (ROW_NUMBER() OVER (ORDER BY study_date DESC)) DAY) as grp
        FROM Dates
    )
    SELECT COUNT(*) as streak
    FROM ConsecutiveDays
    WHERE grp = (SELECT grp FROM ConsecutiveDays LIMIT 1)
    AND (study_date = CURRENT_DATE OR study_date = DATE_SUB(CURRENT_DATE, INTERVAL 1 DAY))
";

$streak_result = $conn->query($streak_sql);
if ($streak_result && $row = $streak_result->fetch_assoc()) {
    $response['data']['streak'] = intval($row['streak']);
}

// 2. Fetch Activity Heatmap Data (Last 4 months)
$heatmap_sql = "
    SELECT DATE(attempt_time) as date, COUNT(*) as count
    FROM performance
    WHERE attempt_time >= DATE_SUB(CURRENT_DATE, INTERVAL 4 MONTH)
    GROUP BY DATE(attempt_time)
    ORDER BY date ASC
";

$heatmap_result = $conn->query($heatmap_sql);
$activity_data = [];
if ($heatmap_result) {
    while ($row = $heatmap_result->fetch_assoc()) {
        $activity_data[$row['date']] = intval($row['count']);
    }
}
$response['data']['activity'] = $activity_data;

// 3. Fetch Detailed Activity for the current month (or specific month if requested)
$month = isset($_GET['month']) ? intval($_GET['month']) : date('m');
$year = isset($_GET['year']) ? intval($_GET['year']) : date('Y');

$details_sql = "
    SELECT p.id, p.attempt_time, p.score_with_negative, e.exam_title, s.subject_name
    FROM performance p
    JOIN exams e ON p.exam_id = e.id
    JOIN subjects s ON p.subject_id = s.id
    WHERE MONTH(p.attempt_time) = ? AND YEAR(p.attempt_time) = ?
    ORDER BY p.attempt_time DESC
";

$stmt = $conn->prepare($details_sql);
$stmt->bind_param("ii", $month, $year);
$stmt->execute();
$details_result = $stmt->get_result();
$monthly_details = [];
while ($row = $details_result->fetch_assoc()) {
    $monthly_details[] = $row;
}
$response['data']['monthly_details'] = $monthly_details;

echo json_encode($response);
$conn->close();
?>
