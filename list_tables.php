<?php
require_once 'api/subject/db_connect.php';
$res = $conn->query('SHOW TABLES');
while($row = $res->fetch_row()) {
    echo $row[0] . PHP_EOL;
}
?>
