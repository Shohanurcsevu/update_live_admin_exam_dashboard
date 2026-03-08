<?php
require 'api/subject/db_connect.php';
$res = $conn->query("DESCRIBE study_sessions");
$cols = [];
while($row = $res->fetch_assoc()) {
    $cols[] = $row;
}
echo json_encode($cols, JSON_PRETTY_PRINT);
?>
