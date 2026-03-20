<?php
$_SERVER['HTTP_HOST'] = 'localhost';
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
require_once 'api/subject/db_connect.php';
require_once 'api/question/question_utils.php';

// 1. Create a dummy exam for testing
$conn->query("INSERT INTO exams (subject_id, lesson_id, topic_id, exam_title) VALUES (1, 1, 1, 'Sanitize Test Exam')");
$exam_id = $conn->insert_id;

$test_questions = [
    [
        'question' => 'What is Option E? (E is Correct)',
        'options' => ['A' => 'A', 'B' => 'B', 'C' => 'C', 'D' => 'D', 'E' => 'Correct E'],
        'answer' => 'E',
        'explanation' => 'Test 1'
    ],
    [
        'question' => 'What is Option E? (A is Correct)',
        'options' => ['A' => 'Correct A', 'B' => 'B', 'C' => 'C', 'D' => 'D', 'E' => 'Extra E'],
        'answer' => 'A',
        'explanation' => 'Test 2'
    ]
];

echo "Running insert_questions...\n";
$res = insert_questions($conn, $exam_id, $test_questions);

if ($res['success']) {
    echo "Insertion successful. Checking database...\n";
    $query = $conn->query("SELECT id, question, options, answer FROM questions WHERE exam_id = $exam_id");
    while ($row = $query->fetch_assoc()) {
        echo "ID: " . $row['id'] . "\n";
        echo "Question: " . $row['question'] . "\n";
        echo "Answer: " . $row['answer'] . "\n";
        echo "Options: " . $row['options'] . "\n";
        echo "-------------------\n";
    }
} else {
    echo "Error: " . $res['message'] . "\n";
}

// Cleanup
$conn->query("DELETE FROM questions WHERE exam_id = $exam_id");
$conn->query("DELETE FROM exams WHERE id = $exam_id");
$conn->close();
?>
