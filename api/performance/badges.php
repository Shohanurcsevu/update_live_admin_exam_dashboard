<?php
// FILE: api/performance/badges.php
require_once '../subject/db_connect.php';
date_default_timezone_set('Asia/Dhaka');
header('Content-Type: application/json');

date_default_timezone_set('Asia/Dhaka');

$badges = [
    [
        'id' => 'early_bird',
        'title' => 'Early Bird',
        'description' => 'Daily: Completed an exam before 8:00 AM today',
        'icon' => 'wb_twilight',
        'color' => 'amber',
        'earned' => false
    ],
    [
        'id' => 'night_owl',
        'title' => 'Night Owl',
        'description' => 'Daily: Studied late after 10:00 PM today',
        'icon' => 'dark_mode',
        'color' => 'purple',
        'earned' => false
    ],
    [
        'id' => 'perfectionist',
        'title' => 'Perfectionist',
        'description' => 'Daily: Achieved a 100% score today',
        'icon' => 'target',
        'color' => 'rose',
        'earned' => false
    ],
    [
        'id' => 'marathoner',
        'title' => 'Marathoner',
        'description' => 'Daily: Completed 5+ exams today',
        'icon' => 'directions_run',
        'color' => 'orange',
        'earned' => false
    ],
    [
        'id' => 'weekend_warrior',
        'title' => 'Weekend Warrior',
        'description' => 'Weekly: Active on both Saturday and Sunday this week',
        'icon' => 'shield',
        'color' => 'indigo',
        'earned' => false
    ],
    [
        'id' => 'consistency_7',
        'title' => '7-Day Streak',
        'description' => 'Milestone: Maintained a 7-day study streak',
        'icon' => 'verified',
        'color' => 'blue',
        'earned' => false
    ],
    [
        'id' => 'consistency_30',
        'title' => 'Consistency King',
        'description' => 'Milestone: Maintained a 30-day study streak',
        'icon' => 'workspace_premium',
        'color' => 'indigo',
        'earned' => false
    ],
    [
        'id' => 'subject_explorer',
        'title' => 'Subject Explorer',
        'description' => 'Weekly: Studied 5 different subjects in one week',
        'icon' => 'explore',
        'color' => 'emerald',
        'earned' => false
    ]
];

// 1. Check Early Bird (Today only)
$badges[0]['earned'] = (bool)$conn->query("SELECT EXISTS(SELECT 1 FROM performance WHERE DATE(attempt_time) = CURRENT_DATE AND HOUR(attempt_time) < 8) as earned")->fetch_assoc()['earned'];

// 2. Check Night Owl (Today: after 10 PM or before 4 AM)
$badges[1]['earned'] = (bool)$conn->query("SELECT EXISTS(SELECT 1 FROM performance WHERE DATE(attempt_time) = CURRENT_DATE AND (HOUR(attempt_time) >= 22 OR HOUR(attempt_time) < 4)) as earned")->fetch_assoc()['earned'];

// 3. Check Perfectionist (Today only)
// Criteria: Score >= total marks OR (zero wrong AND zero unanswered)
$badges[2]['earned'] = (bool)$conn->query("
    SELECT EXISTS(
        SELECT 1 FROM performance p 
        JOIN exams e ON p.exam_id = e.id 
        WHERE DATE(p.attempt_time) = CURRENT_DATE 
        AND (
            ROUND(p.score_with_negative, 2) >= ROUND(e.total_marks, 2) 
            OR (p.wrong_answers = 0 AND p.unanswered = 0 AND p.right_answers > 0)
        )
    ) as earned")->fetch_assoc()['earned'];

// 4. Check Marathoner (Today only)
$badges[3]['earned'] = (bool)$conn->query("SELECT EXISTS(SELECT 1 FROM (SELECT DATE(attempt_time) as d, COUNT(*) as c FROM performance WHERE DATE(attempt_time) = CURRENT_DATE GROUP BY d) as dd WHERE c >= 5) as earned")->fetch_assoc()['earned'];

// 5. Check Weekend Warrior (This week only)
$badges[4]['earned'] = (bool)$conn->query("
    SELECT EXISTS(
        SELECT 1 FROM performance p1 
        JOIN performance p2 ON YEARWEEK(p1.attempt_time, 1) = YEARWEEK(NOW(), 1)
        WHERE YEARWEEK(p2.attempt_time, 1) = YEARWEEK(NOW(), 1)
        AND DAYOFWEEK(p1.attempt_time) = 7 AND DAYOFWEEK(p2.attempt_time) = 1
    ) as earned")->fetch_assoc()['earned'];

// 6. Check Consistency (Longest Streak)
$streak_sql = "
    WITH RECURSIVE Dates AS (
        SELECT DISTINCT DATE(attempt_time) as study_date
        FROM performance
        ORDER BY study_date DESC
    ),
    ConsecutiveGroups AS (
        SELECT study_date, 
               DATE_SUB(study_date, INTERVAL (ROW_NUMBER() OVER (ORDER BY study_date DESC)) DAY) as grp
        FROM Dates
    ),
    StreakCounts AS (
        SELECT COUNT(*) as streak_length
        FROM ConsecutiveGroups
        GROUP BY grp
    )
    SELECT MAX(streak_length) as max_streak FROM StreakCounts
";
$max_streak = intval($conn->query($streak_sql)->fetch_assoc()['max_streak']);
$badges[5]['earned'] = ($max_streak >= 7);
$badges[6]['earned'] = ($max_streak >= 30);

// 7. Check Subject Explorer (5 subjects in last 7 days)
$explorer_sql = "
    SELECT COUNT(DISTINCT e.subject_id) as count 
    FROM performance p 
    JOIN exams e ON p.exam_id = e.id 
    WHERE p.attempt_time >= DATE_SUB(CURRENT_DATE, INTERVAL 7 DAY)
";
$subject_count = intval($conn->query($explorer_sql)->fetch_assoc()['count']);
$badges[7]['earned'] = ($subject_count >= 5);

echo json_encode([
    'success' => true,
    'badges' => $badges,
    'earned_count' => count(array_filter($badges, fn($b) => $b['earned']))
]);

$conn->close();
?>
