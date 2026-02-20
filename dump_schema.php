<?php
require_once 'api/subject/db_connect.php';

$tables = ['subjects', 'lessons', 'topics', 'study_sessions', 'performance'];
$schema = [];

foreach ($tables as $table) {
    $res = $conn->query("DESCRIBE $table");
    if ($res) {
        $schema[$table] = $res->fetch_all(MYSQLI_ASSOC);
    }
}

echo json_encode($schema, JSON_PRETTY_PRINT);
?>
