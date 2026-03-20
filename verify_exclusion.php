<?php
// Mock environment for CLI
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
$_SERVER['HTTP_HOST'] = 'localhost';

include_once 'api/subject/db_connect.php';

function test_exclusion($exclude_custom, $exclude_lesson_wise) {
    global $conn;
    
    $_GET['exclude_custom'] = $exclude_custom ? 'true' : 'false';
    $_GET['exclude_lesson_wise'] = $exclude_lesson_wise ? 'true' : 'false';
    $_GET['action'] = 'list';
    $_GET['limit'] = 10;
    $_GET['offset'] = 0;

    echo "Input: exclude_custom=" . ($exclude_custom ? 'true' : 'false') . ", exclude_lesson_wise=" . ($exclude_lesson_wise ? 'true' : 'false') . "\n";
    echo "GET vars: exclude_custom=" . $_GET['exclude_custom'] . ", exclude_lesson_wise=" . $_GET['exclude_lesson_wise'] . "\n";

    // Mimic the logic from api/exam/exam.php
    $where_clauses = [];
    if (isset($_GET['exclude_custom']) && $_GET['exclude_custom'] === 'true') {
        echo "Adding exclude_custom filter\n";
        $where_clauses[] = "e.subject_id IS NOT NULL";
    }

    if (isset($_GET['exclude_lesson_wise']) && $_GET['exclude_lesson_wise'] === 'true') {
        echo "Adding exclude_lesson_wise filter\n";
        $where_clauses[] = "e.lesson_id IS NOT NULL";
    }

    $where_clauses[] = "e.is_deleted = 0";
    $where_clauses[] = "e.exam_title NOT LIKE '%Challenge%'";

    echo "DEBUG: where_clauses = " . json_encode($where_clauses) . "\n";

    $where_sql = count($where_clauses) > 0 ? "WHERE " . implode(" AND ", $where_clauses) : "";
    
    $sql = "SELECT e.id, e.exam_title, e.subject_id, e.lesson_id, e.topic_id 
            FROM exams e 
            $where_sql 
            LIMIT 5";
    
    echo "SQL: $sql\n";
    
    $result = $conn->query($sql);
    if ($result) {
        $count = 0;
        while ($row = $result->fetch_assoc()) {
            echo "ID: {$row['id']} | Title: {$row['exam_title']} | Sub: " . ($row['subject_id'] ?? 'NULL') . " | Lesson: " . ($row['lesson_id'] ?? 'NULL') . "\n";
            $count++;
        }
        echo "Total found: $count\n";
    } else {
        echo "Error: " . $conn->error . "\n";
    }
    echo "--------------------------------------------------\n\n";
}

test_exclusion(true, false); 
test_exclusion(true, true); 
?>
