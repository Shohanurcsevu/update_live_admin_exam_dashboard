<?php
require_once 'api/subject/db_connect.php';
$result = $conn->query("DESCRIBE question_attempts");
$columns = [];
while($row = $result->fetch_assoc()) {
    $columns[] = $row;
}
echo json_encode($columns, JSON_PRETTY_PRINT);
?>
