<?php
require 'api/subject/db_connect.php';

$res = $conn->query("DESCRIBE exams");
$columns = [];
while($row = $res->fetch_assoc()) {
    $columns[] = $row['Field'];
}

echo "Columns in 'exams' table:\n";
print_r($columns);

$conn->close();
?>
