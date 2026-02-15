<?php
require_once 'api/subject/db_connect.php';
$res = $conn->query("SHOW COLUMNS FROM exams");
if ($res) {
    while($row = $res->fetch_assoc()) {
        echo $row['Field'] . " (" . $row['Type'] . ")\n";
    }
}
$conn->close();
?>
