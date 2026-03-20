<?php
$conn = new mysqli('localhost', 'root', '', 'admin_examtaking');
$res = $conn->query("SELECT id, lesson_id, topic_id, exam_title FROM exams WHERE id IN (880, 881, 882, 883, 884)");
while($row = $res->fetch_assoc()) {
    echo "ID: " . $row['id'] . "\n";
    echo "Lesson ID raw: " . var_export($row['lesson_id'], true) . "\n";
    echo "Topic ID raw: " . var_export($row['topic_id'], true) . "\n";
    echo "Title: " . $row['exam_title'] . "\n";
    echo "------------------\n";
}
?>
