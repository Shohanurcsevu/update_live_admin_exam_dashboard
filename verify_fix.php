<?php
require_once 'api/subject/db_connect.php';

// Simulate the summary query
$where_clause = "q.is_deleted = 0";
$summary_sql = "SELECT 
                    COUNT(DISTINCT question) as total_questions,
                    SUM(correct_count) as total_correct,
                    SUM(wrong_count) as total_wrong,
                    SUM(total_attempts) as total_attempts
                FROM (
                    SELECT 
                        q.question,
                        SUM(CASE WHEN qa.is_correct = 1 THEN 1 ELSE 0 END) as correct_count,
                        SUM(CASE WHEN qa.is_correct = 0 AND qa.selected_answer IS NOT NULL THEN 1 ELSE 0 END) as wrong_count,
                        COUNT(qa.id) as total_attempts
                    FROM questions q
                    LEFT JOIN question_attempts qa ON q.id = qa.question_id
                    WHERE $where_clause
                    GROUP BY q.question
                ) as filtered_aggregation";

$res = $conn->query($summary_sql);
if ($res) {
    $row = $res->fetch_assoc();
    echo "SUCCESS: " . json_encode($row);
} else {
    echo "ERROR: " . $conn->error;
}
$conn->close();
?>
