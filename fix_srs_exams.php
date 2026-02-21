<?php
require_once 'api/subject/db_connect.php';

// Mark existing custom-performance exams as is_revision=1 to hide them everywhere
$sql = "UPDATE exams SET is_revision = 1 WHERE 
    exam_title LIKE '%(Srs_review)%' 
    OR exam_title LIKE '%(Wrong)%' 
    OR exam_title LIKE '%(Mixed)%' 
    OR exam_title LIKE '%(Unattempted)%'";

$conn->query($sql);
echo "Updated " . $conn->affected_rows . " existing custom-performance exams to is_revision=1.\n";
$conn->close();
?>
