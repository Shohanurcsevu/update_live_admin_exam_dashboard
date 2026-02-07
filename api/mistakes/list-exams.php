<?php
/**
 * List Exams with Mistakes API
 * 
 * Returns a list of exams that have unresolved mistakes.
 */

require_once '../subject/db_connect.php';
header('Content-Type: application/json');

$query = "
    SELECT 
        m.exam_id, 
        COALESCE(e.exam_title, 'Mystery Custom Quiz') as exam_title,
        COALESCE(s.subject_name, 'General') as subject_name,
        COUNT(DISTINCT m.question_id) as total_mistakes,
        MAX(m.last_missed_at) as last_activity
    FROM mistake_bank m
    LEFT JOIN exams e ON m.exam_id = e.id
    LEFT JOIN subjects s ON m.subject_id = s.id
    WHERE m.resolved = 0 
      AND (e.is_deleted IS NULL OR e.is_deleted = 0)
      AND (s.is_deleted IS NULL OR s.is_deleted = 0)
    GROUP BY m.exam_id
    ORDER BY last_activity DESC
";

$result = $conn->query($query);
$exams = [];

if ($result) {
    while ($row = $result->fetch_assoc()) {
        $exams[] = [
            'exam_id' => intval($row['exam_id']),
            'exam_title' => $row['exam_title'],
            'subject_name' => $row['subject_name'],
            'total_mistakes' => intval($row['total_mistakes']),
            'last_activity' => $row['last_activity']
        ];
    }
}

echo json_encode(['success' => true, 'data' => $exams]);

$conn->close();
?>
