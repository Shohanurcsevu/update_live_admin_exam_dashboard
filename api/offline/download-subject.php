<?php
/**
 * Offline Download Subject API
 * 
 * Fetches all exams and questions for a specific subject.
 */

// Enable error reporting
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once '../subject/db_connect.php';

header('Content-Type: application/json');

$subject_id = isset($_GET['subject_id']) && $_GET['subject_id'] !== 'all' ? intval($_GET['subject_id']) : null;

try {
    // 1. Fetch exams
    if ($subject_id) {
        $exam_sql = "SELECT * FROM exams WHERE subject_id = ? AND is_deleted = 0";
        $stmt = $conn->prepare($exam_sql);
        $stmt->bind_param("i", $subject_id);
    } else {
        $exam_sql = "SELECT * FROM exams WHERE is_deleted = 0";
        $stmt = $conn->prepare($exam_sql);
    }
    
    $stmt->execute();
    $exams_result = $stmt->get_result();
    $exams = [];
    $exam_ids = [];
    while ($row = $exams_result->fetch_assoc()) {
        $exams[] = $row;
        $exam_ids[] = intval($row['id']);
    }
    $stmt->close();

    if (empty($exam_ids)) {
        echo json_encode([
            'success' => true,
            'changes' => [
                'exams' => [],
                'questions' => []
            ]
        ]);
        exit;
    }

    // 2. Fetch all questions for these exams
    if ($subject_id) {
        $placeholders = implode(',', array_fill(0, count($exam_ids), '?'));
        $question_sql = "SELECT * FROM questions WHERE exam_id IN ($placeholders) AND is_deleted = 0";
        $stmt = $conn->prepare($question_sql);
        
        // Bind dynamic number of IDs
        $types = str_repeat('i', count($exam_ids));
        $stmt->bind_param($types, ...$exam_ids);
    } else {
        $question_sql = "SELECT * FROM questions WHERE is_deleted = 0";
        $stmt = $conn->prepare($question_sql);
    }
    
    $stmt->execute();
    $questions_result = $stmt->get_result();
    $questions = [];
    while ($row = $questions_result->fetch_assoc()) {
        if (isset($row['options'])) {
            $row['options'] = json_decode($row['options'], true);
        }
        $questions[] = $row;
    }
    $stmt->close();

    echo json_encode([
        'success' => true,
        'changes' => [
            'exams' => $exams,
            'questions' => $questions
        ]
    ]);

} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}

$conn->close();
?>
