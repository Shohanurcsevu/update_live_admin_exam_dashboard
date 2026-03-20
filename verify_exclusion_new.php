<?php
$conn = new mysqli('localhost', 'root', '', 'admin_examtaking');
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

function run_test($exclude_custom, $exclude_lesson_wise, $exclude_topic_wise) {
    global $conn;
    
    $where = ["e.is_deleted = 0"];
    if ($exclude_custom) $where[] = "e.subject_id IS NOT NULL";
    if ($exclude_lesson_wise) $where[] = "e.lesson_id IS NULL";
    if ($exclude_topic_wise) $where[] = "e.topic_id IS NULL";
    
    $where_sql = "WHERE " . implode(" AND ", $where);
    $sql = "SELECT e.id, e.exam_title, e.subject_id, e.lesson_id, e.topic_id 
            FROM exams e 
            $where_sql 
            ORDER BY e.id DESC 
            LIMIT 10";
    
    echo "Testing: exclude_custom=" . ($exclude_custom ? 'YES' : 'NO') . ", exclude_lesson_wise=" . ($exclude_lesson_wise ? 'YES' : 'NO') . ", exclude_topic_wise=" . ($exclude_topic_wise ? 'YES' : 'NO') . "\n";
    
    $result = $conn->query($sql);
    $count = 0;
    while ($row = $result->fetch_assoc()) {
        echo sprintf("ID: %d | Title: %s | Sub: %s | Lesson: %s | Topic: %s\n", 
            $row['id'], $row['exam_title'], 
            $row['subject_id'] ?? 'NULL', $row['lesson_id'] ?? 'NULL', $row['topic_id'] ?? 'NULL');
        $count++;
    }
    echo "Found: $count rows\n";
    echo "--------------------------------------------------\n\n";
}

echo "EXCLUSION VERIFICATION\n====================\n\n";

// 1. All Exams
run_test(false, false, false);

// 2. Exclude Lesson and Topic Wise
run_test(true, true, true);
?>
