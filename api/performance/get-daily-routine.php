<?php
require_once '../subject/db_connect.php';
header('Content-Type: application/json');

/**
 * Intelligent Daily Routine Creator
 * Generates 4 personalized missions based on SRS, Performance, and Rotation.
 */

$response = [
    'success' => true,
    'missions' => []
];

try {
    // 1. Mission: Master the Backlog (SRS)
    $srs_sql = "SELECT COUNT(*) as due_count FROM question_srs s 
                JOIN questions q ON s.question_id = q.id 
                WHERE s.next_review_at <= CURRENT_TIMESTAMP AND q.is_deleted = 0";
    $srs_due = $conn->query($srs_sql)->fetch_assoc()['due_count'];
    
    if ($srs_due > 0) {
        $response['missions'][] = [
            'id' => 'srs_mastery',
            'title' => 'Master the Backlog',
            'description' => "You have $srs_due items due for review. Clear them to ensure long-term mastery.",
            'icon' => 'history_edu',
            'type' => 'srs',
            'action_label' => 'Start Review',
            'target_page' => 'take-exam-interface',
            'params' => ['mode' => 'srs_review']
        ];
    } else {
        $response['missions'][] = [
            'id' => 'srs_maintained',
            'title' => 'Backlog Cleared',
            'description' => "Your revision queue is empty! Great job maintaining your memory.",
            'icon' => 'verified',
            'type' => 'srs',
            'completed' => true
        ];
    }

    // 2. Mission: Growth Challenge (Lowest Accuracy Subject)
    $growth_sql = "SELECT s.id, s.subject_name, 
                   AVG(p.score_with_negative) as avg_score 
                   FROM performance p 
                   JOIN subjects s ON p.subject_id = s.id 
                   WHERE s.is_deleted = 0 
                   GROUP BY s.id 
                   ORDER BY avg_score ASC 
                   LIMIT 1";
    $growth_res = $conn->query($growth_sql)->fetch_assoc();
    
    if ($growth_res) {
        $response['missions'][] = [
            'id' => 'growth_challenge',
            'title' => 'Growth Challenge',
            'description' => "Focus on {$growth_res['subject_name']}. Your average score is " . round($growth_res['avg_score']) . "%. Let's bump it up!",
            'icon' => 'trending_up',
            'type' => 'growth',
            'subject_id' => $growth_res['id'],
            'action_label' => 'Practice Now',
            'target_page' => 'take-exam-list',
            'params' => ['subject_id' => $growth_res['id']]
        ];
    }

    // 3. Mission: Subject Rotation (Oldest study date)
    $rotation_sql = "SELECT id, subject_name FROM subjects 
                     WHERE is_deleted = 0 
                     ORDER BY last_study_at ASC 
                     LIMIT 1";
    $rotation_res = $conn->query($rotation_sql)->fetch_assoc();
    
    if ($rotation_res) {
        $response['missions'][] = [
            'id' => 'subject_rotation',
            'title' => 'Subject Rotation',
            'description' => "It's been a while since you studied {$rotation_res['subject_name']}. Keep the rotation fresh.",
            'icon' => 'sync',
            'type' => 'rotation',
            'subject_id' => $rotation_res['id'],
            'action_label' => 'Visit Subject',
            'target_page' => 'subject',
            'params' => ['subject_id' => $rotation_res['id']]
        ];
    }

    // 4. Mission: Discovery (Unattempted Lesson)
    $discovery_sql = "SELECT l.id, l.lesson_name, s.subject_name, s.id as subject_id 
                      FROM lessons l 
                      JOIN subjects s ON l.subject_id = s.id 
                      LEFT JOIN performance p ON l.id = p.lesson_id 
                      WHERE p.id IS NULL AND l.is_deleted = 0 AND s.is_deleted = 0 
                      LIMIT 1";
    $discovery_res = $conn->query($discovery_sql)->fetch_assoc();
    
    if ($discovery_res) {
        $response['missions'][] = [
            'id' => 'discovery_mission',
            'title' => 'Discovery Mission',
            'description' => "New territory! Try a lesson in {$discovery_res['subject_name']}: {$discovery_res['lesson_name']}.",
            'icon' => 'explore',
            'type' => 'discovery',
            'lesson_id' => $discovery_res['id'],
            'subject_id' => $discovery_res['subject_id'],
            'action_label' => 'Explore Lesson',
            'target_page' => 'lesson',
            'params' => ['lesson_id' => $discovery_res['id'], 'subject_id' => $discovery_res['subject_id']]
        ];
    }

} catch (Exception $e) {
    $response['success'] = false;
    $response['message'] = $e->getMessage();
}

echo json_encode($response);
$conn->close();
?>
