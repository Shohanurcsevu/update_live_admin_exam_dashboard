<?php
// FILE: api/topic/subjects.php
// Used by the Topic page.
require_once '../subject/db_connect.php';

// MODIFIED: Changed ORDER BY clause to sort by subject_name
$sql = "SELECT id, subject_name FROM subjects ORDER BY id ASC";
$result = $conn->query($sql);

$subjects = [];
if ($result->num_rows > 0) {
    while($row = $result->fetch_assoc()) {
        $subjects[] = $row;
    }
}

echo json_encode(['success' => true, 'data' => $subjects]);
$conn->close();
?>