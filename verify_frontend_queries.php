<?php
$conn = new mysqli('localhost', 'root', '', 'admin_examtaking');

function test_url($params) {
    global $conn;
    $where_clauses = ["is_deleted = 0"];
    
    if (($params['exclude_custom'] ?? 'false') === 'true') {
        $where_clauses[] = "subject_id IS NOT NULL";
    }
    
    if (($params['exclude_lesson_wise'] ?? 'false') === 'true') {
        $where_clauses[] = "lesson_id IS NULL";
    } elseif (($params['only_lesson_wise'] ?? 'false') === 'true') {
        $where_clauses[] = "lesson_id IS NOT NULL";
    }

    $where_sql = "WHERE " . implode(" AND ", $where_clauses);
    $sql = "SELECT id, exam_title, lesson_id FROM exams $where_sql ORDER BY id DESC LIMIT 10";
    
    echo "Query Params: " . http_build_query($params) . "\n";
    $result = $conn->query($sql);
    while($row = $result->fetch_assoc()) {
        printf("ID: %d | Title: %s | L: %s\n", $row['id'], $row['exam_title'], $row['lesson_id'] ?? 'NULL');
    }
    echo "--------------------------------------------------\n";
}

echo "SIMULATING EXAM LIST QUERIES (Updated with conditional logic)\n\n";

// 1. Default Manage Exams view (No filters selected)
echo "1. DEFAULT INVENTORY (Should exclude sub-exams)\n";
test_url([
    'exclude_custom' => 'true',
    'exclude_lesson_wise' => 'true',
    'exclude_topic_wise' => 'true'
]);

// 2. User selects a lesson
echo "2. FILTERED BY LESSON (Should NOT exclude lesson-wise)\n";
test_url([
    'exclude_custom' => 'true',
    'lesson_id' => '177',
    'exclude_topic_wise' => 'true'
]);

// 3. Timely Model Exam logic
echo "3. TIMELY MODEL EXAM (Fully excluded)\n";
test_url([
    'exclude_custom' => 'true',
    'exclude_lesson_wise' => 'true',
    'exclude_topic_wise' => 'true',
    'subject_id' => '10'
]);
?>
