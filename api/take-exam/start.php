<?php
// FILE: api/take-exam/start.php (Corrected)
// This file is called when you click "Take Exam".

require_once '../subject/db_connect.php';
if (empty($_GET['exam_id'])) { 
    echo json_encode(['success' => false, 'message' => 'Exam ID required.']); 
    exit; 
}
$exam_id = intval($_GET['exam_id']);

// --- MODIFIED: Changed JOINs to LEFT JOINs to support exams with NULL topic_id ---
$exam_sql = "SELECT e.*, s.subject_name, l.lesson_name, t.topic_name 
             FROM exams e 
             LEFT JOIN subjects s ON e.subject_id = s.id 
             LEFT JOIN lessons l ON e.lesson_id = l.id 
             LEFT JOIN topics t ON e.topic_id = t.id 
             WHERE e.id = ? AND e.is_deleted = 0";

$stmt = $conn->prepare($exam_sql);
$stmt->bind_param("i", $exam_id);
$stmt->execute();
$exam_details = $stmt->get_result()->fetch_assoc();

if (!$exam_details) { 
    echo json_encode(['success' => false, 'message' => 'Exam not found.']); 
    exit; 
}

// --- NEW: Dynamic Question Counts ---
if (isset($_GET['action'])) {
    if ($_GET['action'] === 'get_counts') {
        $count_sql = "SELECT priority, COUNT(*) as count FROM questions WHERE exam_id = ? AND is_deleted = 0 GROUP BY priority";
        $stmt = $conn->prepare($count_sql);
        $stmt->bind_param("i", $exam_id);
        $stmt->execute();
        $result = $stmt->get_result();
        $counts = ["0" => 0, "1" => 0, "2" => 0, "3" => 0];
        while ($row = $result->fetch_assoc()) {
            $counts[strval($row['priority'])] = intval($row['count']);
        }
        echo json_encode(['success' => true, 'data' => $counts]);
        exit;
    }

    if ($_GET['action'] === 'check') {
        $priorities = isset($_GET['priorities']) ? explode(',', $_GET['priorities']) : [];
        $priorities = array_filter($priorities, function($val) { return $val !== ''; });
        $priorities = array_unique(array_map('intval', $priorities));

        $count_sql = "SELECT COUNT(*) as total FROM questions WHERE exam_id = ? AND is_deleted = 0";
        if (!empty($priorities)) {
            $placeholders = implode(',', array_fill(0, count($priorities), '?'));
            $count_sql .= " AND priority IN ($placeholders)";
        }

        $stmt = $conn->prepare($count_sql);
        $bind_types = "i" . str_repeat("i", count($priorities));
        $bind_params = array_merge([$exam_id], $priorities);
        
        $stmt->bind_param($bind_types, ...$bind_params);
        $stmt->execute();
        $count = $stmt->get_result()->fetch_assoc()['total'];
        
        echo json_encode(['success' => true, 'count' => intval($count)]);
        exit;
    }
}

$num_questions = isset($_GET['num_questions']) ? intval($_GET['num_questions']) : 0;
$priorities = isset($_GET['priorities']) ? explode(',', $_GET['priorities']) : [];
$priorities = array_filter($priorities, function($val) { return $val !== ''; });
$priorities = array_unique(array_map('intval', $priorities));

$question_sql = "SELECT id, subject_id, lesson_id, topic_id, question, options, answer, explanation, priority FROM questions WHERE exam_id = ? AND is_deleted = 0";

if (!empty($priorities)) {
    $placeholders = implode(',', array_fill(0, count($priorities), '?'));
    $question_sql .= " AND priority IN ($placeholders)";
}

if ($num_questions > 0) {
    $question_sql .= " ORDER BY RAND() LIMIT ?";
}

$stmt = $conn->prepare($question_sql);

// Bind parameters dynamically
$bind_types = "i";
$bind_params = [$exam_id];

if (!empty($priorities)) {
    $bind_types .= str_repeat("i", count($priorities));
    foreach ($priorities as $p) $bind_params[] = $p;
}

if ($num_questions > 0) {
    $bind_types .= "i";
    $bind_params[] = $num_questions;
}

$stmt->bind_param($bind_types, ...$bind_params);
$stmt->execute();
$result = $stmt->get_result();
$questions = [];
while ($row = $result->fetch_assoc()) {
    $row['options'] = json_decode($row['options'], true);
    $questions[] = $row;
}

echo json_encode(['success' => true, 'data' => ['details' => $exam_details, 'questions' => $questions]]);
$stmt->close();
$conn->close();
?>