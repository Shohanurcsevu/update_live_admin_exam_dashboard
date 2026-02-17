<?php
require_once 'api/subject/db_connect.php';

$sql = "SELECT 
            e.id, 
            e.exam_title, 
            e.total_marks,
            p.last_score,
            (p.last_score / NULLIF(e.total_marks, 0)) * 100 as last_percentage,
            p.total_attempts as attempt_count
        FROM exams e
        LEFT JOIN (
            SELECT 
                exam_id, 
                score_with_negative as last_score,
                COUNT(*) as total_attempts
            FROM performance
            WHERE (exam_id, attempt_number) IN (
                SELECT exam_id, MAX(attempt_number)
                FROM performance
                GROUP BY exam_id
            )
            GROUP BY exam_id
        ) p ON e.id = p.exam_id
        WHERE e.is_deleted = 0 AND e.is_revision = 0
        LIMIT 5";

$result = $conn->query($sql);
$data = [];
while ($row = $result->fetch_assoc()) {
    $data[] = $row;
}

header('Content-Type: application/json');
echo json_encode($data, JSON_PRETTY_PRINT);
