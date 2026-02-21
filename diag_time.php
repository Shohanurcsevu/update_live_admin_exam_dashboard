<?php
require_once 'api/subject/db_connect.php';

echo "SRS Time Diagnostic\n";
echo "====================\n\n";

// 1. Check current times
$res = $conn->query("SELECT CURRENT_TIMESTAMP as db_now");
$db_now = $res->fetch_assoc()['db_now'];
$php_now = date('Y-m-d H:i:s');

echo "Database Now: $db_now\n";
echo "PHP Now:      $php_now\n\n";

// 2. Check soonest review dates
$sql = "SELECT next_review_at, COUNT(*) as count 
        FROM question_srs 
        GROUP BY next_review_at 
        ORDER BY next_review_at ASC 
        LIMIT 10";
$result = $conn->query($sql);

echo "Next 10 Review Batches:\n";
if ($result->num_rows > 0) {
    while($row = $result->fetch_assoc()) {
        $status = (strtotime($row['next_review_at']) <= strtotime($db_now)) ? "[DUE]" : "[FUTURE]";
        echo "- {$row['next_review_at']} ($status): {$row['count']} questions\n";
    }
} else {
    echo "No SRS records found.\n";
}

// 3. Overall stats
$sql = "SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN next_review_at <= '$db_now' THEN 1 ELSE 0 END) as due_db_now,
            SUM(CASE WHEN next_review_at <= '$php_now' THEN 1 ELSE 0 END) as due_php_now
        FROM question_srs";
$stats = $conn->query($sql)->fetch_assoc();

echo "\nSummary:\n";
echo "- Total tracked: {$stats['total']}\n";
echo "- Due (DB Time): {$stats['due_db_now']}\n";
echo "- Due (PHP Time): {$stats['due_php_now']}\n";

$conn->close();
?>
