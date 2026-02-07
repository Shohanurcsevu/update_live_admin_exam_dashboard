<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

require_once '../subject/db_connect.php';

// Auto-generate flashcards from mistake bank
// Only creates cards for questions answered incorrectly 2+ times

try {
    // Find questions with 2+ mistakes that don't already have flashcards
    $sql = "
        SELECT 
            mb.question_id,
            COUNT(*) as mistake_count,
            MAX(mb.added_at) as last_mistake
        FROM mistake_bank mb
        LEFT JOIN flashcards f ON f.question_id = mb.question_id
        WHERE f.id IS NULL
        GROUP BY mb.question_id
        HAVING mistake_count >= 2
        ORDER BY mistake_count DESC, last_mistake DESC
    ";
    
    $result = $conn->query($sql);
    
    $cards_created = 0;
    $insert_stmt = $conn->prepare("
        INSERT INTO flashcards (question_id, box_level, next_review)
        VALUES (?, 1, CURRENT_DATE)
    ");
    
    while ($row = $result->fetch_assoc()) {
        $insert_stmt->bind_param("i", $row['question_id']);
        if ($insert_stmt->execute()) {
            $cards_created++;
        }
    }
    
    echo json_encode([
        'success' => true,
        'cards_created' => $cards_created,
        'message' => $cards_created > 0 
            ? "Created $cards_created new flashcards from your mistakes!" 
            : "No new flashcards to create. Keep studying!"
    ]);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => 'Failed to generate flashcards: ' . $e->getMessage()
    ]);
}

$conn->close();
?>
