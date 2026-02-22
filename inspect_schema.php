<?php
require_once 'api/subject/db_connect.php';
$sql = "SELECT s.subject_name, COUNT(qs.question_id) as total, 
               SUM(CASE WHEN qs.next_review_at <= CURRENT_TIMESTAMP THEN 1 ELSE 0 END) as due
        FROM question_srs qs
        JOIN questions q ON qs.question_id = q.id
        JOIN subjects s ON q.subject_id = s.id
        GROUP BY s.id";
$res = $conn->query($sql);
echo "Final SRS Distribution by Subject:\n";
while($row = $res->fetch_assoc()) {
    echo "Subject: {$row['subject_name']}, Total Tracked: {$row['total']}, Due Now: {$row['due']}\n";
}
$conn->close();
?>
