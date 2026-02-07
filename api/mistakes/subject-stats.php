<?php
/**
 * Subject-wise Mistake Stats API
 * 
 * Returns unresolved mistake counts for each active subject.
 */

require_once '../subject/db_connect.php';
header('Content-Type: application/json');

$query = "
    SELECT 
        s.id as subject_id,
        s.subject_name,
        COUNT(DISTINCT mb.question_id) as mistake_count
    FROM subjects s
    LEFT JOIN mistake_bank mb ON s.id = mb.subject_id AND mb.resolved = 0 AND mb.is_offline = 0
    LEFT JOIN exams e ON mb.exam_id = e.id
    WHERE s.is_deleted = 0
      AND (e.id IS NULL OR e.is_deleted = 0)
    GROUP BY s.id, s.subject_name
    ORDER BY mistake_count DESC, s.subject_name ASC
";

$result = $conn->query($query);
$stats = [];

if ($result) {
    while ($row = $result->fetch_assoc()) {
        $stats[] = [
            'subject_id' => intval($row['subject_id']),
            'subject_name' => $row['subject_name'],
            'mistake_count' => intval($row['mistake_count'])
        ];
    }
}

echo json_encode(['success' => true, 'data' => $stats]);

$conn->close();
?>
