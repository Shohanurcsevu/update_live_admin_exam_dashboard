<?php
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
$_SERVER['HTTP_HOST'] = 'localhost';

include_once 'api/subject/db_connect.php';

function run_test($exclude_custom, $exclude_lesson_wise) {
    global $conn;
    
    $where = ["e.is_deleted = 0"];
    if ($exclude_custom) $where[] = "e.subject_id IS NOT NULL";
    if ($exclude_lesson_wise) $where[] = "e.lesson_id IS NOT NULL";
    
    $where_sql = "WHERE " . implode(" AND ", $where);
    $sql = "SELECT e.id, e.exam_title, e.subject_id, e.lesson_id 
            FROM exams e 
            $where_sql 
            ORDER BY e.id DESC 
            LIMIT 10";
    
    echo "Testing: exclude_custom=" . ($exclude_custom ? 'YES' : 'NO') . ", exclude_lesson_wise=" . ($exclude_lesson_wise ? 'YES' : 'NO') . "\n";
    echo "SQL: $sql\n";
    
    $result = $conn->query($sql);
    $count = 0;
    while ($row = $result->fetch_assoc()) {
        $type = "Regular/Topic";
        if ($row['subject_id'] === null) $type = "CUSTOM";
        else if ($row['lesson_id'] === null) $type = "LESSON-WISE";
        
        echo sprintf("[%s] ID: %d | Title: %s | Sub: %s | Lesson: %s\n", 
            $type, $row['id'], $row['exam_title'], 
            $row['subject_id'] ?? 'NULL', $row['lesson_id'] ?? 'NULL');
        $count++;
    }
    echo "Found: $count rows\n";
    echo "--------------------------------------------------\n\n";
}

ob_start();
echo "VERIFICATION RESULTS\n====================\n\n";

// 1. Show some exams with no filters to see what exists
run_test(false, false);

// 2. Exclude only custom
run_test(true, false);

// 3. Exclude both (The new functionality)
run_test(true, true);

$output = ob_get_clean();
echo $output;
file_put_contents('c:/xampp/htdocs/rethink/verify_results_clean.txt', $output);
?>
