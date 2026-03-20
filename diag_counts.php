<?php
$conn = new mysqli('localhost', 'root', '', 'admin_examtaking');
$queries = [
    "Total" => "SELECT count(*) FROM exams",
    "Lesson is NULL" => "SELECT count(*) FROM exams WHERE lesson_id IS NULL",
    "Lesson is NOT NULL" => "SELECT count(*) FROM exams WHERE lesson_id IS NOT NULL",
    "Lesson is 0" => "SELECT count(*) FROM exams WHERE lesson_id = 0",
    "Topic is NULL" => "SELECT count(*) FROM exams WHERE topic_id IS NULL",
    "Topic is NOT NULL" => "SELECT count(*) FROM exams WHERE topic_id IS NOT NULL",
    "Topic is 0" => "SELECT count(*) FROM exams WHERE topic_id = 0",
    "Lesson NOT NULL AND Topic IS NULL" => "SELECT count(*) FROM exams WHERE lesson_id IS NOT NULL AND topic_id IS NULL",
    "Both Lesson and Topic NOT NULL" => "SELECT count(*) FROM exams WHERE lesson_id IS NOT NULL AND topic_id IS NOT NULL",
    "Both Lesson and Topic > 0" => "SELECT count(*) FROM exams WHERE lesson_id > 0 AND topic_id > 0"
];

foreach ($queries as $name => $sql) {
    $res = $conn->query($sql);
    $row = $res->fetch_row();
    echo "$name: " . $row[0] . "\n";
}
?>
