<?php
require_once('api/subject/db_connect.php');
$r = $conn->query("SELECT COUNT(*) as count FROM questions WHERE subject_id IS NULL");
$row = $r->fetch_assoc();
echo 'Null Subjects: ' . $row['count'] . "\n";
?>
