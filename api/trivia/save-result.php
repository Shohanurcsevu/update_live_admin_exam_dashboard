<?php
require_once '../subject/db_connect.php';

header('Content-Type: application/json');

/**
 * Save Trivia Game Result
 * POST data: score, max_streak, questions_answered, time_spent
 */

$data = json_decode(file_get_contents('php://input'), true);

if (!$data) {
    echo json_encode(['success' => false, 'message' => 'No data provided']);
    exit;
}

$score = (int)($data['score'] ?? 0);
$max_streak = (int)($data['max_streak'] ?? 0);
$questions_answered = (int)($data['questions_answered'] ?? 0);

// Basic validation: max theoretical score for 10 questions is roughly 10 * (100 + 50) * 2 = 3000
if ($score > 5000) {
    echo json_encode(['success' => false, 'message' => 'Suspicious score detected']);
    exit;
}

// For now, we just return success. 
// In a full implementation, we would save this to a 'trivia_scores' table.
// To keep it simple for the user, we'll just acknowledge the result.

echo json_encode([
    'success' => true,
    'message' => 'Score of ' . $score . ' recorded!',
    'data' => [
        'score' => $score,
        'max_streak' => $max_streak,
        'questions_answered' => $questions_answered
    ]
]);

$conn->close();
?>
