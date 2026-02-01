<?php
require_once '../subject/db_connect.php';

if (empty($_GET['attempt_id'])) {
    echo json_encode(['success' => false, 'message' => 'Attempt ID is required.']);
    exit;
}
$attempt_id = intval($_GET['attempt_id']);

// 1. Get performance details
$perf_stmt = $conn->prepare("SELECT * FROM performance WHERE id = ?");
$perf_stmt->bind_param("i", $attempt_id);
$perf_stmt->execute();
$performance = $perf_stmt->get_result()->fetch_assoc();
$perf_stmt->close();

if (!$performance) {
    echo json_encode(['success' => false, 'message' => 'Performance record not found.']);
    exit;
}

// 2. Get exam details
$exam_sql = "SELECT e.*, s.subject_name, l.lesson_name, t.topic_name 
             FROM exams e 
             LEFT JOIN subjects s ON e.subject_id = s.id 
             LEFT JOIN lessons l ON e.lesson_id = l.id 
             LEFT JOIN topics t ON e.topic_id = t.id 
             WHERE e.id = ?";

$exam_stmt = $conn->prepare($exam_sql);
$exam_stmt->bind_param("i", $performance['exam_id']);
$exam_stmt->execute();
$exam = $exam_stmt->get_result()->fetch_assoc();
$exam_stmt->close();

if (!$exam) {
    echo json_encode(['success' => false, 'message' => 'The associated exam could not be found.']);
    exit;
}

// 3. Get all questions for that exam
// --- MODIFIED: Added `explanation` to the SELECT statement ---
$q_stmt = $conn->prepare("SELECT id, question, options, answer, explanation FROM questions WHERE exam_id = ?");
$q_stmt->bind_param("i", $performance['exam_id']);
$q_stmt->execute();
$result = $q_stmt->get_result();
$questions = [];
while($row = $result->fetch_assoc()) {
    $questions[] = $row;
}
$q_stmt->close();

$response = [
    'performance' => $performance,
    'exam' => $exam,
    'questions' => $questions
];

echo json_encode(['success' => true, 'data' => $response]);
$conn->close();
?>
