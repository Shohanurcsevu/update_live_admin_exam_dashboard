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
        'earned' => false,
        'current' => 0,
        'target' => 1
    ],
    [
        'id' => 'night_owl',
        'title' => 'Night Owl',
        'description' => 'Daily: Studied late after 10:00 PM today',
        'icon' => 'dark_mode',
        'color' => 'purple',
        'earned' => false,
        'current' => 0,
        'target' => 1
    ],
    [
        'id' => 'perfectionist',
        'title' => 'Perfectionist',
        'description' => 'Daily: Achieved a 100% score today',
        'icon' => 'target',
        'color' => 'rose',
        'earned' => false,
        'current' => 0,
        'target' => 1
    ],
    [
        'id' => 'marathoner',
        'title' => 'Marathoner',
        'description' => 'Daily: Completed 5+ exams today',
        'icon' => 'directions_run',
        'color' => 'orange',
        'earned' => false,
        'current' => 0,
        'target' => 5
    ],
    [
        'id' => 'weekend_warrior',
        'title' => 'Weekend Warrior',
        'description' => 'Weekly: Active on both Saturday and Sunday this week',
        'icon' => 'shield',
        'color' => 'indigo',
        'earned' => false,
        'current' => 0,
        'target' => 2
    ],
    [
        'id' => 'consistency_7',
        'title' => '7-Day Streak',
        'description' => 'Milestone: Maintained a 7-day study streak',
        'icon' => 'verified',
        'color' => 'blue',
        'earned' => false,
        'current' => 0,
        'target' => 7
    ],
    [
        'id' => 'consistency_30',
        'title' => 'Consistency King',
        'description' => 'Milestone: Maintained a 30-day study streak',
        'icon' => 'workspace_premium',
        'color' => 'indigo',
        'earned' => false,
        'current' => 0,
        'target' => 30
    ],
    [
        'id' => 'subject_explorer',
        'title' => 'Subject Explorer',
        'description' => 'Weekly: Studied 5 different subjects in one week',
        'icon' => 'explore',
        'color' => 'emerald',
        'earned' => false,
        'current' => 0,
        'target' => 5
    ]
];

// 1. Check Early Bird (Today only)
$res0 = $conn->query("SELECT COUNT(*) as c FROM performance WHERE DATE(attempt_time) = CURRENT_DATE AND HOUR(attempt_time) < 8")->fetch_assoc();
$badges[0]['current'] = min(1, intval($res0['c']));
$badges[0]['earned'] = ($badges[0]['current'] >= $badges[0]['target']);

// 2. Check Night Owl (Today: after 10 PM or before 4 AM)
$res1 = $conn->query("SELECT COUNT(*) as c FROM performance WHERE DATE(attempt_time) = CURRENT_DATE AND (HOUR(attempt_time) >= 22 OR HOUR(attempt_time) < 4)")->fetch_assoc();
$badges[1]['current'] = min(1, intval($res1['c']));
$badges[1]['earned'] = ($badges[1]['current'] >= $badges[1]['target']);

// 3. Check Perfectionist (Today only)
$res2 = $conn->query("
    SELECT COUNT(*) as c FROM performance p 
    JOIN exams e ON p.exam_id = e.id 
    WHERE DATE(p.attempt_time) = CURRENT_DATE 
    AND (
        ROUND(p.score_with_negative, 2) >= ROUND(e.total_marks, 2) 
        OR (p.wrong_answers = 0 AND p.unanswered = 0 AND p.right_answers > 0)
    )")->fetch_assoc();
$badges[2]['current'] = min(1, intval($res2['c']));
$badges[2]['earned'] = ($badges[2]['current'] >= $badges[2]['target']);

// 4. Check Marathoner (Today only)
$res3 = $conn->query("SELECT COUNT(*) as c FROM performance WHERE DATE(attempt_time) = CURRENT_DATE")->fetch_assoc();
$badges[3]['current'] = intval($res3['c']);
$badges[3]['earned'] = ($badges[3]['current'] >= $badges[3]['target']);

// 5. Check Weekend Warrior (This week only) - Count distinct active days (Sat/Sun)
$res4 = $conn->query("
    SELECT COUNT(DISTINCT DAYOFWEEK(attempt_time)) as c 
    FROM performance 
    WHERE YEARWEEK(attempt_time, 1) = YEARWEEK(NOW(), 1)
    AND DAYOFWEEK(attempt_time) IN (1, 7)
")->fetch_assoc();
$badges[4]['current'] = intval($res4['c']);
$badges[4]['earned'] = ($badges[4]['current'] >= $badges[4]['target']);

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
$badges[5]['current'] = $max_streak;
$badges[5]['earned'] = ($max_streak >= $badges[5]['target']);
$badges[6]['current'] = $max_streak;
$badges[6]['earned'] = ($max_streak >= $badges[6]['target']);

// 7. Check Subject Explorer (5 subjects in last 7 days)
$explorer_sql = "
    SELECT COUNT(DISTINCT e.subject_id) as count 
    FROM performance p 
    JOIN exams e ON p.exam_id = e.id 
    WHERE p.attempt_time >= DATE_SUB(CURRENT_DATE, INTERVAL 7 DAY)
";
$subject_count = intval($conn->query($explorer_sql)->fetch_assoc()['count']);
$badges[7]['current'] = $subject_count;
$badges[7]['earned'] = ($subject_count >= $badges[7]['target']);

echo json_encode([
    'success' => true,
    'badges' => $badges,
    'earned_count' => count(array_filter($badges, fn($b) => $b['earned']))
]);

$conn->close();
?>
