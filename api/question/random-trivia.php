<?php
require_once '../subject/db_connect.php';

header('Content-Type: application/json');

/**
 * Fetch 10 random questions for Speed Trivia
 */

$limit = 15;

try {
    // Select 10 random questions that are not deleted
    // Aliasing columns to match frontend expectations or project standards
    $sql = "SELECT id, question, options, answer, subject_id, topic_id 
            FROM questions 
            WHERE is_deleted = 0 
            ORDER BY RAND() 
            LIMIT ?";
            
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("i", $limit);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $questions = [];
    while ($row = $result->fetch_assoc()) {
        $q = [
            'id' => (int)$row['id'],
            'question_text' => $row['question'],
            'subject_id' => (int)$row['subject_id'],
            'topic_id' => (int)$row['topic_id']
        ];
        
        // Handle options
        $options = json_decode($row['options'], true);
        if (is_array($options)) {
            // Conversion if options are stored as object {"A": "val", ...}
            if (!isset($options[0])) {
                $q['options'] = array_values($options);
            } else {
                $q['options'] = $options;
            }
            
            // Robust answer mapping for A,B,C,D or 1,2,3,4
            $answerMap = ['A' => 1, 'B' => 2, 'C' => 3, 'D' => 4, 'E' => 5];
            $rawAnswer = strtoupper(trim($row['answer']));
            if (isset($answerMap[$rawAnswer])) {
                $q['correct_option'] = $answerMap[$rawAnswer];
            } else {
                $q['correct_option'] = (int)$rawAnswer;
            }
        } else {
            $q['options'] = [];
            $q['correct_option'] = 0;
        }
        
        $questions[] = $q;
    }
    
    echo json_encode([
        'success' => true,
        'data' => $questions
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to fetch trivia questions: ' . $e->getMessage()
    ]);
} finally {
    if (isset($stmt)) $stmt->close();
    $conn->close();
}
?>
