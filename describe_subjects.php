<?php
require_once 'api/subject/db_connect.php';
$res = $conn->query('DESCRIBE subjects');
while($row = $res->fetch_assoc()) {
    echo $row['Field'] . ' - ' . $row['Type'] . PHP_EOL;
}
?>
