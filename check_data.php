<?php
require_once 'api/subject/db_connect.php';
$r = $conn->query('SELECT * FROM lessons LIMIT 5');
while($row = $r->fetch_assoc()) {
    print_r($row);
}
?>
