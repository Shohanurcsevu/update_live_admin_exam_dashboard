<?php
require_once '../subject/db_connect.php';

if (empty($_GET['topic_id'])) {
    echo json_encode(['success' => false, 'message' => 'Topic ID is required.']);
    exit;
}

$topic_id = intval($_GET['topic_id']);

// Fetch all questions for the topic
$stmt = $conn->prepare("
    SELECT q.*, t.topic_name, l.lesson_name, s.subject_name
    FROM questions q
    JOIN topics t ON q.topic_id = t.id
    JOIN lessons l ON t.lesson_id = l.id
    JOIN subjects s ON l.subject_id = s.id
    WHERE q.topic_id = ? AND q.is_deleted = 0 
    ORDER BY q.id ASC
");
$stmt->bind_param("i", $topic_id);
$stmt->execute();
$result = $stmt->get_result();

$questions = [];
while ($row = $result->fetch_assoc()) {
    $row['options'] = json_decode($row['options']);
    $questions[] = $row;
}

$topic_info = $questions[0] ?? null;

echo json_encode([
    'success' => true,
    'data' => [
        'questions' => $questions,
        'details' => $topic_info ? [
            'title' => $topic_info['topic_name'],
            'subject' => $topic_info['subject_name'],
            'lesson' => $topic_info['lesson_name']
        ] : null
    ]
]);

$stmt->close();
$conn->close();
?>
