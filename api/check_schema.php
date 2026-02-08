<?php
require_once 'subject/db_connect.php';
$result = $conn->query("DESCRIBE exams");
$columns = [];
while($row = $result->fetch_assoc()) {
    $columns[] = $row['Field'];
}
echo json_encode($columns);
?>
