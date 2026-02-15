<?php
header("Content-Type: application/json; charset=UTF-8");
require_once '../subject/db_connect.php';

$limit = 15;
$questions = [];
$used_ids = [];

// --- Step 1: Priority questions first (priority > 0, highest first) ---
$priority_sql = "SELECT id, subject_id, lesson_id, topic_id, question, options, answer 
                 FROM questions 
                 WHERE is_deleted = 0 AND priority > 0 
                 ORDER BY priority DESC 
                 LIMIT $limit";
$priority_result = $conn->query($priority_sql);
while ($row = $priority_result->fetch_assoc()) {
    $row['options'] = json_decode($row['options'], true);
    $questions[] = $row;
    $used_ids[] = $row['id'];
}

// --- Step 2: Subject coverage (1 question per subject, excluding already used) ---
if (count($questions) < $limit) {
    $subject_sql = "SELECT DISTINCT subject_id FROM questions WHERE is_deleted = 0";
    $subject_result = $conn->query($subject_sql);
    $subject_ids = [];
    while ($row = $subject_result->fetch_assoc()) {
        $subject_ids[] = $row['subject_id'];
    }
    shuffle($subject_ids);

    foreach ($subject_ids as $s_id) {
        if (count($questions) >= $limit) break;

        $exclude_sql = count($used_ids) > 0 ? "AND id NOT IN (" . implode(',', $used_ids) . ")" : "";
        $q_sql = "SELECT id, subject_id, lesson_id, topic_id, question, options, answer 
                  FROM questions 
                  WHERE subject_id = ? AND is_deleted = 0 $exclude_sql 
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
}

// --- Step 3: Random fill for remaining slots ---
$remaining = $limit - count($questions);
if ($remaining > 0) {
    $exclude_sql = count($used_ids) > 0 ? "AND id NOT IN (" . implode(',', $used_ids) . ")" : "";
    $rand_sql = "SELECT id, subject_id, lesson_id, topic_id, question, options, answer 
                 FROM questions 
                 WHERE is_deleted = 0 $exclude_sql 
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
