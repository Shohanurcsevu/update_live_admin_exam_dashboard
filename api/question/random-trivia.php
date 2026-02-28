<?php
require_once '../subject/db_connect.php';

header('Content-Type: application/json');

/**
 * Fetch 10 random questions for Speed Trivia
 */

$rawLimit = isset($_GET['limit']) ? (int)$_GET['limit'] : 15;
$limit = ($rawLimit === 0) ? 0 : max(5, min(50, $rawLimit));

// --- Filter Parameters ---
$type = $_GET['source_type'] ?? 'random';
$subject_id = isset($_GET['subject_id']) ? (int)$_GET['subject_id'] : null;
$lesson_id = isset($_GET['lesson_id']) ? (int)$_GET['lesson_id'] : null;
$topic_id = isset($_GET['topic_id']) ? (int)$_GET['topic_id'] : null;
$exam_id = isset($_GET['exam_id']) ? (int)$_GET['exam_id'] : null;

try {
    $where = "WHERE is_deleted = 0 AND subject_id IS NOT NULL";
    $params = [];
    $types = "";

    if ($type !== 'random') {
        if ($subject_id) {
            $where .= " AND subject_id = ?";
            $params[] = $subject_id;
            $types .= "i";
        }
        if ($lesson_id) {
            $where .= " AND lesson_id = ?";
            $params[] = $lesson_id;
            $types .= "i";
        }
        if ($topic_id) {
            $where .= " AND topic_id = ?";
            $params[] = $topic_id;
            $types .= "i";
        }
        if ($exam_id) {
            // Questions associated with a specific exam often via an exam_questions mapping or direct topic/lesson links
            // Here we assume questions are tagged with source context
            $where .= " AND exam_id = ?";
            $params[] = $exam_id;
            $types .= "i";
        }
    }

    $sql = "SELECT id, question, options, answer, subject_id, topic_id 
            FROM questions 
            $where
            ORDER BY RAND()";

    if ($limit > 0) {
        $sql .= " LIMIT ?";
        $params[] = $limit;
        $types .= "i";
    }

    $stmt = $conn->prepare($sql);
    $stmt->bind_param($types, ...$params);
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
