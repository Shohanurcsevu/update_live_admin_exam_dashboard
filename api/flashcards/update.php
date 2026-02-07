<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

require_once '../subject/db_connect.php';

// Update flashcard after review using Leitner algorithm
// Moves cards between boxes based on correct/incorrect answers

$data = json_decode(file_get_contents('php://input'), true);
$card_id = isset($data['card_id']) ? intval($data['card_id']) : 0;
$is_correct = isset($data['is_correct']) ? boolval($data['is_correct']) : false;

if (!$card_id) {
    echo json_encode(['success' => false, 'error' => 'Card ID required']);
    exit;
}

try {
    // Get current card state
    $stmt = $conn->prepare("SELECT box_level, times_reviewed, times_correct FROM flashcards WHERE id = ?");
    $stmt->bind_param("i", $card_id);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($row = $result->fetch_assoc()) {
        $current_box = intval($row['box_level']);
        $times_reviewed = intval($row['times_reviewed']) + 1;
        $times_correct = intval($row['times_correct']) + ($is_correct ? 1 : 0);
        
        // Leitner Algorithm: Calculate new box level
        if ($is_correct) {
            $new_box = min($current_box + 1, 5); // Move up, max box 5
        } else {
            $new_box = 1; // Move back to box 1
        }
        
        // Calculate next review date based on box level
        $intervals = [
            1 => 1,   // 1 day
            2 => 3,   // 3 days
            3 => 7,   // 7 days
            4 => 14,  // 14 days
            5 => 30   // 30 days
        ];
        $days_until_next = $intervals[$new_box];
        
        // Update card
        $update_stmt = $conn->prepare("
            UPDATE flashcards 
            SET box_level = ?,
                last_reviewed = NOW(),
                next_review = DATE_ADD(CURRENT_DATE, INTERVAL ? DAY),
                times_reviewed = ?,
                times_correct = ?
            WHERE id = ?
        ");
        
        $update_stmt->bind_param("iiiii", $new_box, $days_until_next, $times_reviewed, $times_correct, $card_id);
        $update_stmt->execute();
        
        echo json_encode([
            'success' => true,
            'new_box_level' => $new_box,
            'next_review_days' => $days_until_next,
            'accuracy' => $times_reviewed > 0 ? round(($times_correct / $times_reviewed) * 100, 1) : 0,
            'message' => $is_correct 
                ? ($new_box == 5 ? "Mastered! 🎉" : "Great! Moving to Box $new_box")
                : "Let's review this again tomorrow"
        ]);
    } else {
        echo json_encode(['success' => false, 'error' => 'Card not found']);
    }
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => 'Failed to update card: ' . $e->getMessage()
    ]);
}

$conn->close();
?>
