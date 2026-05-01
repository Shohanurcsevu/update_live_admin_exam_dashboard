<?php
require 'api/subject/db_connect.php';
$res = $conn->query('SELECT id, subject_name FROM subjects WHERE is_deleted = 0 ORDER BY subject_name ASC');
echo "Subjects in DB (ORDER BY subject_name ASC):\n";
while($row = $res->fetch_assoc()) {
    echo "- ID: {$row['id']} | Name: {$row['subject_name']}\n";
}
