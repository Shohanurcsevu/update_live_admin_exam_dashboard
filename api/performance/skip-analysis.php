<?php
require_once '../subject/db_connect.php';
header('Content-Type: application/json');

/**
 * Aggregates skips (unattempted questions) by subject 
 * to identify knowledge gaps.
 */

$sql = "SELECT 
            s.id as subject_id,
            s.subject_name,
            SUM(CASE WHEN qa.selected_answer IS NULL AND qa.id IS NOT NULL THEN 1 ELSE 0 END) as skip_count
        FROM subjects s
        JOIN questions q ON s.id = q.subject_id
        LEFT JOIN question_attempts qa ON q.id = qa.question_id
        WHERE q.is_deleted = 0
        GROUP BY s.id
        HAVING skip_count > 0
        ORDER BY skip_count DESC";

try {
    $result = $conn->query($sql);
    $analysis = $result->fetch_all(MYSQLI_ASSOC);
    
    echo json_encode([
        'success' => true,
        'analysis' => $analysis
    ]);
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}

$conn->close();
?>
