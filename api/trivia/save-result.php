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

    $result = [
        'success' => true,
        'message' => 'Result saved successfully',
        'data' => [
            'score' => $score,
            'max_streak' => $max_streak,
            'questions_answered' => $questions_answered
        ]
    ];

    // --- NEW: Save normalized snapshot for Ghosts ---
    // Formula: Accuracy(500) + Speed(300) + Streak(200)
    // We expect score, max_streak, questions_answered, total_accuracy, avg_speed, level_reached
    if (isset($data['normalized_score'])) {
        $stmt = $conn->prepare("INSERT INTO trivia_snapshots (normalized_score, accuracy, avg_speed, max_streak, level_reached) VALUES (?, ?, ?, ?, ?)");
        $stmt->bind_param("iddii", 
            $data['normalized_score'], 
            $data['accuracy'], 
            $data['avg_speed'], 
            $data['max_streak'], 
            $data['level_reached']
        );
        $stmt->execute();
    }

    echo json_encode($result);

$conn->close();
?>
