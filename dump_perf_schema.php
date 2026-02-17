<?php
require_once 'api/subject/db_connect.php';

$res = $conn->query("DESCRIBE performance");
while($row = $res->fetch_assoc()) {
    print_r($row);
}
