<?php
header("Content-Type: application/json; charset=UTF-8");
require_once '../subject/db_connect.php';

$limit = 15;
$questions = [];
$used_ids = [];

// 1. Get all subjects that have questions
$subject_sql = "SELECT DISTINCT subject_id FROM questions WHERE is_deleted = 0";
$subject_result = $conn->query($subject_sql);
$subject_ids = [];
while ($row = $subject_result->fetch_assoc()) {
    $subject_ids[] = $row['subject_id'];
}

if (empty($subject_ids)) {
    echo json_encode(['success' => false, 'message' => 'No questions found in database.']);
    exit;
}

// Shuffle subjects to pick different ones first if we have more than $limit
shuffle($subject_ids);

// 2. Pick at least one question from each subject (up to $limit)
foreach ($subject_ids as $s_id) {
    if (count($questions) >= $limit) break;

    $q_sql = "SELECT id, subject_id, lesson_id, topic_id, question, options, answer 
              FROM questions 
              WHERE subject_id = ? AND is_deleted = 0 
              ORDER BY RAND() LIMIT 1";
    $stmt = $conn->prepare($q_sql);
    $stmt->bind_param("i", $s_id);
    $stmt->execute();
    $q_result = $stmt->get_result();
    if ($row = $q_result->fetch_assoc()) {
        $row['options'] = json_decode($row['options'], true);
        $questions[] = $row;
        $used_ids[] = $row['id'];
    }
    $stmt->close();
}

// 3. If we still need more questions, pick randomly from all questions
$remaining = $limit - count($questions);
if ($remaining > 0) {
    $placeholders = count($used_ids) > 0 ? "AND id NOT IN (" . implode(',', $used_ids) . ")" : "";
    $rand_sql = "SELECT id, subject_id, lesson_id, topic_id, question, options, answer 
                 FROM questions 
                 WHERE is_deleted = 0 $placeholders 
                 ORDER BY RAND() LIMIT $remaining";
    
    $result = $conn->query($rand_sql);
    while ($row = $result->fetch_assoc()) {
        $row['options'] = json_decode($row['options'], true);
        $questions[] = $row;
    }
}

// Final shuffle to mix subjects
shuffle($questions);

echo json_encode([
    'success' => true, 
    'data' => $questions,
    'count' => count($questions)
]);

$conn->close();
?>
