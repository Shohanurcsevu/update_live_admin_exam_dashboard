<?php
require_once 'api/subject/db_connect.php';

echo "SRS Diagnostic Report\n";
echo "=====================\n\n";

// 1. Check for Duplicate Questions (by text)
$sql = "SELECT question, COUNT(*) as count FROM questions GROUP BY question HAVING count > 1 ORDER BY count DESC LIMIT 10";
$result = $conn->query($sql);
echo "Top 10 Duplicate Question Texts:\n";
if ($result->num_rows > 0) {
    while($row = $result->fetch_assoc()) {
        echo "- [{$row['count']} times]: " . substr($row['question'], 0, 50) . "...\n";
    }
} else {
    echo "No duplicate question texts found.\n";
}
echo "\n";

// 2. Check SRS records for these duplicates
$sql = "SELECT q.question, COUNT(s.question_id) as srs_records 
        FROM questions q 
        JOIN question_srs s ON q.id = s.question_id 
        GROUP BY q.question 
        HAVING srs_records > 1";
$result = $conn->query($sql);
echo "Questions with multiple SRS records (due to copies):\n";
if ($result->num_rows > 0) {
    while($row = $result->fetch_assoc()) {
        echo "- [{$row['srs_records']} SRS records]: " . substr($row['question'], 0, 50) . "...\n";
    }
} else {
    echo "No questions found with multiple SRS records.\n";
}
echo "\n";

// 3. Check stats from srs-stats.php vs grouped count
$sql1 = "SELECT COUNT(*) as count FROM question_srs";
$count_raw = $conn->query($sql1)->fetch_assoc()['count'];

$sql2 = "SELECT COUNT(DISTINCT q.question) as count 
         FROM question_srs s 
         JOIN questions q ON s.question_id = q.id";
$count_grouped = $conn->query($sql2)->fetch_assoc()['count'];

echo "Stats Comparison:\n";
echo "- Total SRS Records: $count_raw\n";
echo "- Unique Questions in SRS: $count_grouped\n";

if ($count_raw > $count_grouped) {
    echo "\nWARNING: SRS logic is confirmed to be overcounting by " . ($count_raw - $count_grouped) . " records due to question copies.\n";
}

$conn->close();
?>
