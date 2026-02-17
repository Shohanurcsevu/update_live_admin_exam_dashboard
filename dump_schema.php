<?php
require_once 'api/subject/db_connect.php';
$tables = ['questions', 'performance', 'exams'];
foreach ($tables as $table) {
    echo "--- $table ---\n";
    $result = $conn->query("DESCRIBE $table");
    if ($result) {
        while ($row = $result->fetch_assoc()) {
            echo json_encode($row) . "\n";
        }
    }
}
?>
