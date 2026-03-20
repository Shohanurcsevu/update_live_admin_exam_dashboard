<?php
require_once '../subject/db_connect.php';
header('Content-Type: application/json');

/**
 * Smart Study Recommendations Engine (AI-Lite)
 * Analyzes performance data to suggest weak areas for study.
 */

$response = [
    'success' => true,
    'recommendations' => []
];

try {
    // 1. Get Weighted Failure Rates per Subject/Lesson
    // We look for areas with high wrong_count relative to total attempts.
    // We also consider priority to nudge towards important questions.
    
    $sql = "SELECT 
                s.id as subject_id,
                s.subject_name,
                l.id as lesson_id,
                l.lesson_name,
                SUM(CASE WHEN qa.is_correct = 0 THEN 1 ELSE 0 END) as wrong_count,
                COUNT(qa.id) as total_attempts,
                AVG(q.priority) as avg_priority
            FROM questions q
            JOIN subjects s ON q.subject_id = s.id
            JOIN lessons l ON q.lesson_id = l.id
            LEFT JOIN question_attempts qa ON q.id = qa.question_id
            WHERE q.is_deleted = 0
            GROUP BY s.id, l.id
            HAVING COUNT(qa.id) > 0 AND SUM(CASE WHEN qa.is_correct = 0 THEN 1 ELSE 0 END) > 0
            ORDER BY (SUM(CASE WHEN qa.is_correct = 0 THEN 1 ELSE 0 END) / COUNT(qa.id)) DESC, AVG(q.priority) DESC
            LIMIT 3";

    $result = $conn->query($sql);
    
    if ($result) {
        while ($row = $result->fetch_assoc()) {
            $wrong_rate = round(($row['wrong_count'] / $row['total_attempts']) * 100);
            
            // Logic for different recommendation types
            if ($wrong_rate >= 60) {
                $type = 'critical';
                $title = "Critical Growth Area";
                $message = "You've missed {$wrong_rate}% of questions in '{$row['lesson_name']}' ({$row['subject_name']}). Master this now!";
            } else if ($wrong_rate >= 30) {
                $type = 'revision';
                $title = "Revision Recommended";
                $message = "Your accuracy in '{$row['lesson_name']}' is around " . (100 - $wrong_rate) . "%. A quick review would help.";
            } else {
                continue; // Skip areas where user is doing well
            }

            $response['recommendations'][] = [
                'type' => $type,
                'title' => $title,
                'message' => $message,
                'subject_id' => $row['subject_id'],
                'lesson_id' => $row['lesson_id'],
                'wrong_rate' => $wrong_rate
            ];
        }
    }

    // 2. If no performance-based recommendations, suggest unattempted areas
    if (empty($response['recommendations'])) {
        $unattempted_sql = "SELECT 
                                s.id as subject_id,
                                s.subject_name,
                                l.id as lesson_id,
                                l.lesson_name,
                                COUNT(q.id) as total_q,
                                COUNT(qa.id) as attempts
                            FROM questions q
                            JOIN subjects s ON q.subject_id = s.id
                            JOIN lessons l ON q.lesson_id = l.id
                            LEFT JOIN question_attempts qa ON q.id = qa.question_id
                            WHERE q.is_deleted = 0
                            GROUP BY s.id, l.id
                            HAVING attempts = 0
                            ORDER BY RAND()
                            LIMIT 1";
        
        $un_res = $conn->query($unattempted_sql);
        if ($un_res && $row = $un_res->fetch_assoc()) {
            $response['recommendations'][] = [
                'type' => 'discovery',
                'title' => "New Frontier",
                'message' => "You haven't attempted any questions in '{$row['lesson_name']}' yet. Ready to start?",
                'subject_id' => $row['subject_id'],
                'lesson_id' => $row['lesson_id']
            ];
        }
    }

    // 3. Last fallback: Just suggest some random lesson
    if (empty($response['recommendations'])) {
        $any_lesson_sql = "SELECT 
                                s.id as subject_id,
                                s.subject_name,
                                l.id as lesson_id,
                                l.lesson_name
                            FROM lessons l
                            JOIN subjects s ON l.subject_id = s.id
                            WHERE s.is_deleted = 0
                            ORDER BY RAND()
                            LIMIT 1";
        
        $any_res = $conn->query($any_lesson_sql);
        if ($any_res && $row = $any_res->fetch_assoc()) {
            $response['recommendations'][] = [
                'type' => 'discovery',
                'title' => "Daily Pick",
                'message' => "How about a quick session on '{$row['lesson_name']}' ({$row['subject_name']})?",
                'subject_id' => $row['subject_id'],
                'lesson_id' => $row['lesson_id']
            ];
        }
    }

} catch (Exception $e) {
    $response['success'] = false;
    $response['message'] = $e->getMessage();
}

    echo json_encode($response);
$conn->close();
?>
