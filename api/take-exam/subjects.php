<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST, GET, PUT, DELETE");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

// FILE: api/take-exam/subjects.php
// Used by the Take Exam page.
require_once '../subject/db_connect.php';

// MODIFIED: Changed ORDER BY clause to sort by subject_name
$sql = "SELECT id, subject_name FROM subjects WHERE is_deleted = 0 ORDER BY id ASC";
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