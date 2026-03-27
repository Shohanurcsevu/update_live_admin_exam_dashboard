<?php
require_once 'api/subject/db_connect.php';

echo "### Checking question_attempts schema ###\n";
$res = $conn->query("SHOW COLUMNS FROM question_attempts");
$columns = [];
while ($row = $res->fetch_assoc()) {
    $columns[] = $row['Field'];
}
echo "Columns: " . implode(", ", $columns) . "\n";
$has_user_id = in_array('user_id', $columns) || in_array('student_id', $columns);
echo "Has user isolation? " . ($has_user_id ? "YES" : "NO") . "\n\n";

echo "### Checking for nested clones (Chains > 1 level) ###\n";
$sql = "SELECT q1.id as leaf, q1.original_question_id as parent, q2.original_question_id as grandparent 
        FROM questions q1 
        JOIN questions q2 ON q1.original_question_id = q2.id 
        WHERE q2.original_question_id IS NOT NULL 
        LIMIT 10";
$res = $conn->query($sql);
if ($res && $res->num_rows > 0) {
    echo "Found nested clones! This breaks the 1nd-level COALESCE in start.php\n";
    while ($row = $res->fetch_assoc()) {
        echo "Leaf {$row['leaf']} -> Parent {$row['parent']} -> Grandparent {$row['grandparent']}\n";
    }
} else {
    echo "No obvious nested clones (3 levels deep) found.\n";
}

echo "\n### Checking for session-based isolation ###\n";
// Sometimes the logic uses 'session_id' or similar if it's one device. 
// But start.php doesn't seem to have any user/session filtering.

echo "\n### VERDICT ON LOGIC ###\n";
echo "1. Standard start.php Join: LEFT JOIN question_attempts qa ON COALESCE(q.original_question_id, q.id) = qa.question_id\n";
echo "2. If a user completes an exam, every question in that exam now has an entry in question_attempts.\n";
echo "3. If they click 'Take' again with the SAME exam_id, all questions are now 'attempted'.\n";
echo "4. The logic '(CASE WHEN COUNT(qa.selected_answer) = 0 THEN 0 ELSE 1 END) ASC' will prioritize unattempted.\n";
echo "5. If 0 unattempted exist, they all have CASE=1, and it falls back to 'wrong_count DESC'.\n";
echo "6. This means users will see attempted questions again if they have already finished the entire question pool for that exam or topic.\n";

$conn->close();
?>
