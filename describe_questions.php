<?php
require_once('api/subject/db_connect.php');
$r = $conn->query("DESCRIBE questions");
while($row = $r->fetch_assoc()) {
    echo $row['Field'] . " (" . $row['Type'] . ")\n";
}
?>
