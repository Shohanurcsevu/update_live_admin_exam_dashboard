<?php
// FILE: api/performance/goal-status.php
require_once '../subject/db_connect.php';
header('Content-Type: application/json');

date_default_timezone_set('Asia/Dhaka');

$response = [
    'success' => true,
    'goals' => [
        'setup' => [
            'subject_coverage' => ['title' => 'Exams for every subject', 'completed' => false, 'current' => 0, 'total' => 0],
            'exam_completion' => ['title' => 'All exams completed', 'completed' => false, 'current' => 0, 'total' => 0]
        ],
        'daily' => [
            'across_subjects' => ['title' => 'Across Subjects Exam', 'completed' => false],
            'topic_wise' => ['title' => 'Topic-wise Exam', 'completed' => false],
            'lesson_wise' => ['title' => 'Lesson-wise Exam', 'completed' => false]
        ]
    ]
];

// 1. Subject Coverage
$total_subjects_sql = "SELECT COUNT(*) as count FROM subjects WHERE is_deleted = 0";
$total_subjects = $conn->query($total_subjects_sql)->fetch_assoc()['count'];

$covered_subjects_sql = "SELECT COUNT(DISTINCT subject_id) as count FROM exams WHERE is_deleted = 0 AND subject_id IS NOT NULL";
$covered_subjects = $conn->query($covered_subjects_sql)->fetch_assoc()['count'];

$response['goals']['setup']['subject_coverage']['current'] = intval($covered_subjects);
$response['goals']['setup']['subject_coverage']['total'] = intval($total_subjects);
$response['goals']['setup']['subject_coverage']['completed'] = ($covered_subjects >= $total_subjects && $total_subjects > 0);

// 2. Exam Completion
$total_exams_sql = "SELECT COUNT(*) as count FROM exams WHERE is_deleted = 0";
$total_exams = $conn->query($total_exams_sql)->fetch_assoc()['count'];

$attempted_exams_sql = "SELECT COUNT(DISTINCT exam_id) as count FROM performance p JOIN exams e ON p.exam_id = e.id WHERE e.is_deleted = 0";
$attempted_exams = $conn->query($attempted_exams_sql)->fetch_assoc()['count'];

$response['goals']['setup']['exam_completion']['current'] = intval($attempted_exams);
$response['goals']['setup']['exam_completion']['total'] = intval($total_exams);
$response['goals']['setup']['exam_completion']['completed'] = ($attempted_exams >= $total_exams && $total_exams > 0);

// 3. Daily Across Subjects
$daily_across_sql = "
    SELECT EXISTS(
        SELECT 1 FROM performance p 
        JOIN exams e ON p.exam_id = e.id 
        WHERE DATE(p.attempt_time) = CURRENT_DATE 
        AND e.lesson_id IS NULL AND e.topic_id IS NULL
    ) as completed";
$response['goals']['daily']['across_subjects']['completed'] = (bool)$conn->query($daily_across_sql)->fetch_assoc()['completed'];

// 4. Daily Topic-wise
$daily_topic_sql = "
    SELECT EXISTS(
        SELECT 1 FROM performance p 
        JOIN exams e ON p.exam_id = e.id 
        WHERE DATE(p.attempt_time) = CURRENT_DATE 
        AND e.topic_id IS NOT NULL
    ) as completed";
$response['goals']['daily']['topic_wise']['completed'] = (bool)$conn->query($daily_topic_sql)->fetch_assoc()['completed'];

// 5. Daily Lesson-wise
$daily_lesson_sql = "
    SELECT EXISTS(
        SELECT 1 FROM performance p 
        JOIN exams e ON p.exam_id = e.id 
        WHERE DATE(p.attempt_time) = CURRENT_DATE 
        AND e.lesson_id IS NOT NULL AND e.topic_id IS NULL
    ) as completed";
$response['goals']['daily']['lesson_wise']['completed'] = (bool)$conn->query($daily_lesson_sql)->fetch_assoc()['completed'];

echo json_encode($response);
$conn->close();
?>
