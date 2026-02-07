<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

require_once '../subject/db_connect.php';

// Get flashcards due for review
// Fetches cards where next_review <= today, limited to 20 per session

$topic_id = isset($_GET['topic_id']) ? intval($_GET['topic_id']) : null;
$limit = isset($_GET['limit']) ? intval($_GET['limit']) : 20;

try {
    $sql = "
        SELECT 
            f.id as card_id,
            f.box_level,
            f.times_reviewed,
            f.times_correct,
            q.id as question_id,
            q.question_text,
            q.option_a,
            q.option_b,
            q.option_c,
            q.option_d,
            q.correct_answer,
            q.explanation,
            t.topic_name,
            s.subject_name
        FROM flashcards f
        JOIN questions q ON f.question_id = q.id
        JOIN topics t ON q.topic_id = t.id
        JOIN subjects s ON t.subject_id = s.id
        WHERE f.next_review <= CURRENT_DATE
    ";
    
    $params = [];
    $types = "";
    
    if ($topic_id) {
        $sql .= " AND t.id = ?";
        $params[] = $topic_id;
        $types .= "i";
    }
    
    $sql .= " ORDER BY f.box_level ASC, RAND() LIMIT ?";
    $params[] = $limit;
    $types .= "i";
    
    if (count($params) > 0) {
        $stmt = $conn->prepare($sql);
        $stmt->bind_param($types, ...$params);
        $stmt->execute();
        $result = $stmt->get_result();
    } else {
        $result = $conn->query($sql);
    }
    
    $cards = [];
    while ($row = $result->fetch_assoc()) {
        $cards[] = [
            'card_id' => intval($row['card_id']),
            'box_level' => intval($row['box_level']),
            'times_reviewed' => intval($row['times_reviewed']),
            'times_correct' => intval($row['times_correct']),
            'question' => [
                'id' => intval($row['question_id']),
                'text' => $row['question_text'],
                'options' => [
                    'A' => $row['option_a'],
                    'B' => $row['option_b'],
                    'C' => $row['option_c'],
                    'D' => $row['option_d']
                ],
                'correct_answer' => $row['correct_answer'],
                'explanation' => $row['explanation'],
                'topic' => $row['topic_name'],
                'subject' => $row['subject_name']
            ]
        ];
    }
    
    echo json_encode([
        'success' => true,
        'cards' => $cards,
        'count' => count($cards)
    ]);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => 'Failed to fetch review cards: ' . $e->getMessage()
    ]);
}

$conn->close();
?>
