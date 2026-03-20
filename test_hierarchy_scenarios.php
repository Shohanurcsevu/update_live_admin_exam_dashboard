<?php
// Local verification script for hierarchy filtering
$conn = new mysqli('localhost', 'root', '', 'admin_examtaking');
if ($conn->connect_error) die("Connection failed: " . $conn->connect_error);

function test_scenario($name, $params) {
    global $conn;
    $where_clauses = ["is_deleted = 0"];
    
    // Simulate API logic from exam.php
    if (($params['exclude_custom'] ?? 'false') === 'true') {
        $where_clauses[] = "subject_id IS NOT NULL";
    }
    
    if (($params['only_lesson_wise'] ?? 'false') === 'true') {
        $where_clauses[] = "lesson_id IS NOT NULL";
    }
    if (($params['only_topic_wise'] ?? 'false') === 'true') {
        $where_clauses[] = "topic_id IS NOT NULL";
    }

    $where_sql = "WHERE " . implode(" AND ", $where_clauses);
    $sql = "SELECT id, exam_title, lesson_id, topic_id FROM exams $where_sql ORDER BY id DESC LIMIT 10";
    
    echo "SCENARIO: $name\n";
    echo "Query: $sql\n";
    $result = $conn->query($sql);
    $count = 0;
    while($row = $result->fetch_assoc()) {
        $count++;
        echo "ID: {$row['id']} | L: " . ($row['lesson_id'] ?? 'NULL') . " | T: " . ($row['topic_id'] ?? 'NULL') . " | Title: {$row['exam_title']}\n";
    }
    if ($count === 0) echo "NO RESULTS FOUND\n";
    echo "--------------------------------------------------\n\n";
}

// Case 1: The current logic I implemented
test_scenario("CURRENT INVENTORY LOGIC", [
    'exclude_custom' => 'true',
    'only_lesson_wise' => 'true',
    'only_topic_wise' => 'true'
]);

// Case 2: Only Subject-wise (What I think they were seeing)
test_scenario("SUBJECT-ONLY EXAMS (Lesson & Topic NULL)", [
    'exclude_custom' => 'true',
    'exclude_lesson_wise' => 'true',
    'exclude_topic_wise' => 'true'
]);

// Case 3: Lesson-only but no Topic
test_scenario("LESSON-WISE BUT NO TOPIC", [
    'exclude_custom' => 'true',
    'only_lesson_wise' => 'true',
    'exclude_topic_wise' => 'true'
]);

?>
