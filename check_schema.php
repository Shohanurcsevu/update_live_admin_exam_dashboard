<?php
require_once 'api/subject/db_connect.php';
$res = $conn->query("DESCRIBE exam_presets");
$cols = [];
while($row = $res->fetch_assoc()) {
    $cols[] = $row['Field'];
}
echo implode(", ", $cols);
?>
