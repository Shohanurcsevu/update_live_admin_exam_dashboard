<?php
header("Content-Type: application/json; charset=UTF-8");
require_once '../subject/db_connect.php';

$data = json_decode(file_get_contents("php://input"), true);
$limit = isset($data['limit']) ? intval($data['limit']) : 15;
$mode = isset($data['mode']) ? $data['mode'] : 'daily_15';

$questions = [];
$used_ids = [];

// --- Step 1: Priority questions first (priority > 0, highest first) ---
$priority_sql = "SELECT id, subject_id, lesson_id, topic_id, question, options, answer, explanation 
                 FROM questions 
                 WHERE is_deleted = 0 AND priority > 0 
                 ORDER BY priority DESC 
                 LIMIT $limit";
$priority_result = $conn->query($priority_sql);
while ($row = $priority_result->fetch_assoc()) {
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
        $q_sql = "SELECT id, subject_id, lesson_id, topic_id, question, options, answer, explanation 
                  FROM questions 
                  WHERE subject_id = ? AND is_deleted = 0 $exclude_sql 
                  ORDER BY RAND() LIMIT 1";
        $stmt = $conn->prepare($q_sql);
        $stmt->bind_param("i", $s_id);
        $stmt->execute();
        $q_result = $stmt->get_result();
        if ($row = $q_result->fetch_assoc()) {
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
    $rand_sql = "SELECT id, subject_id, lesson_id, topic_id, question, options, answer, explanation 
                 FROM questions 
                 WHERE is_deleted = 0 $exclude_sql 
                 ORDER BY RAND() LIMIT $remaining";
    
    $result = $conn->query($rand_sql);
    while ($row = $result->fetch_assoc()) {
        $questions[] = $row;
    }
}

shuffle($questions);

// 4. Create a persistent Exam entry
$conn->begin_transaction();
try {
    $dateTitle = date("M d");
    $examTitle = ($mode === 'daily_15' ? "Daily 15 Challenge" : "Daily 10 Challenge") . " - $dateTitle";
    
    $stmt = $conn->prepare("INSERT INTO exams (exam_title, duration, instructions, total_marks, pass_mark, negative_mark_value) 
                            VALUES (?, ?, ?, ?, ?, 0.5)");
    
    $instructions = "Focus and practice across all subjects. MISSION: MASTER EVERYTHING.";
    $passMark = ceil($limit * 0.4);
    
    $stmt->bind_param("sisdd", $examTitle, $limit, $instructions, $limit, $passMark);
    $stmt->execute();
    $new_exam_id = $conn->insert_id;
    $stmt->close();

    // 5. Insert question snapshots linked to this exam
    $insert_q_stmt = $conn->prepare("INSERT INTO questions (subject_id, lesson_id, topic_id, exam_id, question, options, answer, explanation) 
                                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)");

    foreach ($questions as $q) {
        $insert_q_stmt->bind_param("iiiissss", 
            $q['subject_id'], $q['lesson_id'], $q['topic_id'], $new_exam_id, 
            $q['question'], $q['options'], $q['answer'], $q['explanation']
        );
        $insert_q_stmt->execute();
    }
    $insert_q_stmt->close();

    $conn->commit();

    // Fetch details for the response
    $exam_details = [
        'id' => $new_exam_id,
        'exam_title' => $examTitle,
        'duration' => $limit,
        'total_marks' => $limit,
        'pass_mark' => $passMark,
        'instructions' => $instructions
    ];

    // --- NEW: Fetch the actual questions we just inserted to get the new IDs ---
    $fetch_synced_q = $conn->prepare("SELECT id, subject_id, lesson_id, topic_id, question, options, answer, explanation FROM questions WHERE exam_id = ? AND is_deleted = 0");
    $fetch_synced_q->bind_param("i", $new_exam_id);
    $fetch_synced_q->execute();
    $synced_result = $fetch_synced_q->get_result();
    $synced_questions = [];
    while ($row = $synced_result->fetch_assoc()) {
        $row['options'] = json_decode($row['options'], true);
        $synced_questions[] = $row;
    }
    $fetch_synced_q->close();

    echo json_encode([
        'success' => true, 
        'data' => [
            'details' => $exam_details,
            'questions' => $synced_questions
        ]
    ]);

} catch (Exception $e) {
    $conn->rollback();
    echo json_encode(['success' => false, 'message' => 'Error: ' . $e->getMessage()]);
}

$conn->close();
?>
