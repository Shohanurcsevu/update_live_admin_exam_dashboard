<?php
require_once('api/subject/db_connect.php');
$r = $conn->query("SHOW TABLES");
while($row = $r->fetch_row()) {
    echo $row[0] . "\n";
}
?>
