<?php
$conn = new mysqli('localhost', 'root', '', 'admin_examtaking');
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}
echo "--- SCHEMA ---\n";
$res = $conn->query('DESC exams');
while($row = $res->fetch_assoc()) {
    echo $row['Field'] . ' (' . $row['Type'] . ')' . PHP_EOL;
}
echo "\n--- SAMPLE DATA (LATEST 10) ---\n";
$res = $conn->query('SELECT id, exam_title, subject_id, lesson_id, topic_id FROM exams ORDER BY id DESC LIMIT 10');
while($row = @$res->fetch_assoc()) {
    echo "ID: " . $row['id'] . " | Title: " . $row['exam_title'] . " | SID: " . $row['subject_id'] . " | LID: " . ($row['lesson_id'] ?? 'NULL') . " | TID: " . ($row['topic_id'] ?? 'NULL') . PHP_EOL;
}
