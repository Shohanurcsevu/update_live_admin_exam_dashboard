<?php
require_once('api/subject/db_connect.php');
echo "--- Exam Columns ---\n";
$r = $conn->query("SHOW COLUMNS FROM exams");
while($row = $r->fetch_assoc()) echo $row['Field']."\n";

echo "\n--- Count per Group ---\n";
$res = $conn->query("SELECT subject_id, lesson_id, topic_id, COUNT(*) as count FROM exams GROUP BY subject_id, lesson_id, topic_id LIMIT 10");
while($row = $res->fetch_assoc()) {
    print_r($row);
}

echo "\n--- Custom-looking Exams (NULL parents) ---\n";
$res = $conn->query("SELECT id, exam_title FROM exams WHERE subject_id IS NULL OR lesson_id IS NULL LIMIT 5");
while($row = $res->fetch_assoc()) {
    print_r($row);
}
?>
