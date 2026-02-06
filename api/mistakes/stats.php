<?php
/**
 * Mistake Bank Stats API
 */

require_once '../subject/db_connect.php';
header('Content-Type: application/json');

$sql = "
    SELECT COUNT(*) as total_mistakes 
    FROM mistake_bank mb
    LEFT JOIN exams e ON mb.exam_id = e.id
    LEFT JOIN subjects s ON mb.subject_id = s.id
    WHERE mb.resolved = 0 
      AND (e.is_deleted IS NULL OR e.is_deleted = 0)
      AND (s.is_deleted IS NULL OR s.is_deleted = 0)
";
$result = $conn->query($sql);

if ($result) {
    $row = $result->fetch_assoc();
    echo json_encode([
        'success' => true,
        'count' => intval($row['total_mistakes'])
    ]);
} else {
    echo json_encode([
        'success' => false,
        'message' => $conn->error
    ]);
}

$conn->close();
?>
