<?php
$conn = new mysqli('localhost', 'root', '', 'admin_examtaking');
if ($conn->connect_error) die("Connection failed: " . $conn->connect_error);

$ids = [884, 883, 882];
foreach ($ids as $id) {
    $res = $conn->query("SELECT id, exam_title, subject_id, lesson_id, topic_id FROM exams WHERE id = $id");
    if ($row = $res->fetch_assoc()) {
        echo json_encode($row) . PHP_EOL;
    }
}
$conn->close();
?>
