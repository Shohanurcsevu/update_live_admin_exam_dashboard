<?php
require_once 'c:/xampp/htdocs/rethink/api/subject/db_connect.php';

echo "Testing api/custom-exam/subjects-with-details.php equivalent logic:\n";
$subject_id = 1; // Assuming subject 1 exists
$lesson_stmt = $conn->prepare("
    SELECT 
        l.id as lesson_id, 
        l.lesson_name, 
        COUNT(DISTINCT q.id) as total_questions,
        (COUNT(DISTINCT q.id) - COUNT(DISTINCT qa.question_id)) as unseen_questions
    FROM lessons l
    LEFT JOIN questions q ON l.id = q.lesson_id AND q.is_deleted = 0
    LEFT JOIN question_attempts qa ON q.id = qa.question_id
    WHERE l.subject_id = ?
    GROUP BY l.id
    LIMIT 1
");
$lesson_stmt->bind_param("i", $subject_id);
$lesson_stmt->execute();
$res = $lesson_stmt->get_result();
print_r($res->fetch_assoc());

echo "\nTesting api/custom-exam/presets.php equivalent logic:\n";
$preset_res = $conn->query("SELECT * FROM exam_presets LIMIT 1");
if ($row = $preset_res->fetch_assoc()) {
    $lessons_data = json_decode($row['lessons_data'], true);
    if (!empty($lessons_data)) {
        $lesson_ids = array_map(function($l) { return intval($l['lesson_id']); }, $lessons_data);
        $ids_placeholder = implode(',', $lesson_ids);
        $unseen_res = $conn->query("
            SELECT (COUNT(DISTINCT q.id) - COUNT(DISTINCT qa.question_id)) as unseen_count
            FROM questions q
            LEFT JOIN question_attempts qa ON q.id = qa.question_id
            WHERE q.lesson_id IN ($ids_placeholder) AND q.is_deleted = 0
        ");
        print_r($unseen_res->fetch_assoc());
    }
}
$conn->close();
?>
