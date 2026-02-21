<?php
require_once 'api/subject/db_connect.php';

echo "SRS Migration Script\n";
echo "====================\n\n";

// 1. Add question_text_hash column if it doesn't exist
$sql = "ALTER TABLE question_srs ADD COLUMN IF NOT EXISTS question_text_hash VARCHAR(32) AFTER question_id";
if (!$conn->query($sql)) {
    die("Error adding column: " . $conn->error . "\n");
}
echo "Checked/Added question_text_hash column.\n";

// 2. Add Index if it doesn't exist (can't use IF NOT EXISTS for index in all MySQL versions, so we use a safe approach)
$index_exists = $conn->query("SHOW INDEX FROM question_srs WHERE Key_name = 'idx_text_hash'")->num_rows > 0;
if (!$index_exists) {
    if ($conn->query("CREATE INDEX idx_text_hash ON question_srs(question_text_hash)")) {
        echo "Created index on question_text_hash.\n";
    }
}

// 3. Populate hashes for existing records
$sql = "SELECT s.question_id, q.question 
        FROM question_srs s 
        JOIN questions q ON s.question_id = q.id 
        WHERE s.question_text_hash IS NULL OR s.question_text_hash = ''";
$result = $conn->query($sql);
$updated = 0;

if ($result && $result->num_rows > 0) {
    echo "Processing " . $result->num_rows . " records...\n";
    $update_stmt = $conn->prepare("UPDATE question_srs SET question_text_hash = ? WHERE question_id = ?");
    while ($row = $result->fetch_assoc()) {
        $hash = md5(trim($row['question']));
        $update_stmt->bind_param("si", $hash, $row['question_id']);
        $update_stmt->execute();
        $updated++;
    }
    $update_stmt->close();
}
echo "Populated hashes for $updated records.\n";

// 4. Consolidate duplicates (Keep the one with the latest next_review_at)
// This is a bit tricky with MySQL. We'll identify hashes with > 1 record.
$sql = "SELECT question_text_hash, COUNT(*) as c, MAX(next_review_at) as latest 
        FROM question_srs 
        GROUP BY question_text_hash HAVING c > 1";
$duplicates = $conn->query($sql);
$consolidated = 0;

if ($duplicates && $duplicates->num_rows > 0) {
    echo "Consolidating " . $duplicates->num_rows . " duplicate hash sets...\n";
    while ($dup = $duplicates->fetch_assoc()) {
        $hash = $dup['question_text_hash'];
        $latest = $dup['latest'];
        
        // Keep the best state (Max interval/consecutive)
        $state_sql = "SELECT MAX(interval_days) as max_int, MAX(consecutive_correct) as max_cons 
                      FROM question_srs WHERE question_text_hash = '$hash'";
        $state = $conn->query($state_sql)->fetch_assoc();
        $max_int = $state['max_int'];
        $max_cons = $state['max_cons'];

        // 1. Delete all but one
        // We pick one question_id to keep
        $keep_id = $conn->query("SELECT question_id FROM question_srs WHERE question_text_hash = '$hash' LIMIT 1")->fetch_assoc()['question_id'];
        
        $conn->query("DELETE FROM question_srs WHERE question_text_hash = '$hash' AND question_id != $keep_id");
        
        // 2. Update the kept one with merged best state
        $conn->query("UPDATE question_srs SET 
                        next_review_at = '$latest', 
                        interval_days = $max_int, 
                        consecutive_correct = $max_cons 
                      WHERE question_id = $keep_id");
        $consolidated++;
    }
}
echo "Consolidated $consolidated sets of duplicates.\n";

// 5. Final check
// We want to make question_text_hash the PRIMARY KEY or at least UNIQUE eventually,
// but since question_id is FK-ish in our submit.php logic right now, we keep it as is for now
// and just ensure uniqueness of hash.

echo "\nMigration complete.\n";
$conn->close();
?>
