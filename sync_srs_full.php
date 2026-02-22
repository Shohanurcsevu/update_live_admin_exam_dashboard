<?php
require_once 'api/subject/db_connect.php';
header('Content-Type: text/plain');

echo "Comprehensive SRS Sync Started...\n";

// 1. Get the latest attempt for every unique question (by hash)
// We join with questions to get the question text for hashing
$sql = "SELECT q.id as question_id, q.question, qa.is_correct, qa.attempted_at
        FROM (
            SELECT question_id, MAX(id) as max_qa_id
            FROM question_attempts
            GROUP BY question_id
        ) latest_qa
        JOIN question_attempts qa ON latest_qa.max_qa_id = qa.id
        JOIN questions q ON qa.question_id = q.id
        ORDER BY qa.attempted_at ASC"; // ASC so later updates in the loop override older ones if hashes collide

$result = $conn->query($sql);
$synced = 0;
$skipped = 0;

if ($result) {
    echo "Processing " . $result->num_rows . " attempt records...\n";
    
    // Prepare the upsert statement
    // We use the same logic as submit.php
    $stmt = $conn->prepare("INSERT INTO question_srs (question_id, question_text_hash, next_review_at, interval_days, consecutive_correct) 
                            VALUES (?, ?, ?, ?, ?) 
                            ON DUPLICATE KEY UPDATE 
                                question_id = VALUES(question_id),
                                next_review_at = VALUES(next_review_at),
                                interval_days = VALUES(interval_days),
                                consecutive_correct = VALUES(consecutive_correct)");

    while ($row = $result->fetch_assoc()) {
        $hash = md5(trim($row['question']));
        $cid = $row['question_id'];
        $is_correct = $row['is_correct'];
        
        // Basic initial state for synced historical data
        // If correct: 1 day interval, 1 consecutive
        // If wrong: 1 day interval, 0 consecutive
        $interval = 1;
        $consecutive = $is_correct ? 1 : 0;
        
        // For historical data, we make it due NOW (midnight of yesterday)
        $next_review = date('Y-m-d 00:00:00', strtotime("-1 day"));

        $stmt->bind_param("issii", $cid, $hash, $next_review, $interval, $consecutive);
        $stmt->execute();
        $synced++;
    }
    $stmt->close();
}

echo "Sync Complete. Total Rows Processed/Updated: $synced\n";
$conn->close();
?>
