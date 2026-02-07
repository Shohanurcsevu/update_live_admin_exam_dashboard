<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

require_once '../subject/db_connect.php';

// Get available flashcard decks grouped by subject and topic
// Returns card counts and cards due today

try {
    $sql = "
        SELECT 
            s.subject_name,
            t.topic_name,
            COUNT(f.id) as total_cards,
            SUM(CASE WHEN f.next_review <= CURRENT_DATE THEN 1 ELSE 0 END) as cards_due,
            AVG(f.box_level) as avg_box_level,
            SUM(CASE WHEN f.times_reviewed > 0 THEN f.times_correct / f.times_reviewed ELSE 0 END) / 
                COUNT(CASE WHEN f.times_reviewed > 0 THEN 1 END) as deck_accuracy
        FROM flashcards f
        JOIN questions q ON f.question_id = q.id
        JOIN topics t ON q.topic_id = t.id
        JOIN subjects s ON t.subject_id = s.id
        GROUP BY s.id, t.id, s.subject_name, t.topic_name
        HAVING total_cards > 0
        ORDER BY cards_due DESC, deck_accuracy ASC
    ";
    
    $result = $conn->query($sql);
    
    $decks = [];
    while ($row = $result->fetch_assoc()) {
        $decks[] = [
            'subject' => $row['subject_name'],
            'topic' => $row['topic_name'],
            'total_cards' => intval($row['total_cards']),
            'cards_due' => intval($row['cards_due']),
            'avg_box_level' => round(floatval($row['avg_box_level']), 1),
            'accuracy' => $row['deck_accuracy'] ? round(floatval($row['deck_accuracy']) * 100, 1) : null
        ];
    }
    
    echo json_encode([
        'success' => true,
        'decks' => $decks,
        'total_decks' => count($decks),
        'total_cards_due' => array_sum(array_column($decks, 'cards_due'))
    ]);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => 'Failed to fetch decks: ' . $e->getMessage()
    ]);
}

$conn->close();
?>
