<?php
// scripts/db_flatten_questions.php
// This script flattens "nested clones" by ensuring every original_question_id 
// points directly to the true root master question (where original_question_id IS NULL).

// Bypass db_connect logic for CLI
define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_NAME', 'admin_examtaking');

$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
if ($conn->connect_error) die("Connection failed: " . $conn->connect_error);

echo "Starting Database Flattening (Root Normalization)...\n";

$sql = "SELECT id, original_question_id FROM questions WHERE original_question_id IS NOT NULL";
$res = $conn->query($sql);

$updates = 0;
$fixed_ids = [];

while ($row = $res->fetch_assoc()) {
    $current_id = $row['id'];
    $original_id = intval($row['original_question_id']);
    
    $true_root_id = $original_id;
    $depth = 0;
    $max_depth = 10;
    
    // Resolve absolute root
    while ($depth < $max_depth) {
        $check_sql = "SELECT original_question_id FROM questions WHERE id = $true_root_id";
        $check_res = $conn->query($check_sql);
        if ($check_row = $check_res->fetch_assoc()) {
            if ($check_row['original_question_id']) {
                $true_root_id = intval($check_row['original_question_id']);
                $depth++;
                continue;
            }
        }
        break;
    }
    
    if ($true_root_id !== $original_id) {
        $update_sql = "UPDATE questions SET original_question_id = $true_root_id WHERE id = $current_id";
        if ($conn->query($update_sql)) {
            echo "Fixed Clone $current_id: $original_id -> $true_root_id (Depth: $depth)\n";
            $updates++;
        }
    }
}

echo "\nTotal records updated: $updates\n";
echo "Normalization Complete.\n";

$conn->close();
