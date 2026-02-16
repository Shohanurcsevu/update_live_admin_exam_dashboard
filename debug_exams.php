<?php
$conn = new mysqli('localhost', 'root', '', 'admin_examtaking');
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

$sql = "SELECT id, exam_title, subject_id, lesson_id, topic_id, is_deleted FROM exams";
$result = $conn->query($sql);

if ($result->num_rows > 0) {
    while($row = $result->fetch_assoc()) {
        echo "ID: " . $row["id"]. " - Title: " . $row["exam_title"]. " - S: " . $row["subject_id"]. " - L: " . $row["lesson_id"]. " - T: " . $row["topic_id"]. " - Deleted: " . $row["is_deleted"]. "\n";
    }
} else {
    echo "0 results";
}
$conn->close();
?>
