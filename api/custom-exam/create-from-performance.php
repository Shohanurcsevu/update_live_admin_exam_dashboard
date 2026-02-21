<?php
require_once '../subject/db_connect.php';
header('Content-Type: application/json');

$data = json_decode(file_get_contents("php://input"), true);

if (empty($data['mode']) || empty($data['exam_title'])) {
    echo json_encode(['success' => false, 'message' => 'Missing required data.']);
    exit;
}

$mode = $data['mode']; // wrong, unattempted, mixed
$subject_id = isset($data['subject_id']) ? intval($data['subject_id']) : null;
$lesson_id = isset($data['lesson_id']) ? intval($data['lesson_id']) : null;
$topic_id = isset($data['topic_id']) ? intval($data['topic_id']) : null;
$limit = isset($data['limit']) ? intval($data['limit']) : 15;

$where = ["q.is_deleted = 0"];
$params = [];
$types = "";

if ($subject_id) {
    $where[] = "q.subject_id = ?";
    $params[] = $subject_id;
    $types .= "i";
}
if ($lesson_id) {
    $where[] = "q.lesson_id = ?";
    $params[] = $lesson_id;
    $types .= "i";
}
if ($topic_id) {
    $where[] = "q.topic_id = ?";
    $params[] = $topic_id;
    $types .= "i";
}

$where_clause = implode(" AND ", $where);

// Logic:
// 1. Get aggregated performance for questions meeting the filters.
// 2. Filter these by mode (e.g., if mode is 'wrong', only keep those with wrong_count > 0).
// 3. Sort by priority, then randomize.
// 4. Create new persistent exam.

// Join with question_srs for SRS mode
$srs_join = "";
if ($mode === 'srs_review') {
    $srs_join = "JOIN question_srs srs ON MD5(TRIM(q.question)) = srs.question_text_hash AND srs.next_review_at <= CURRENT_TIMESTAMP";
}


$sql = "SELECT 
            q.question,
            MAX(q.id) as ref_id,
            MAX(q.priority) as priority,
            SUM(CASE WHEN qa.is_correct = 0 THEN 1 ELSE 0 END) as wrong_count,
            SUM(CASE WHEN qa.selected_answer IS NULL AND qa.id IS NOT NULL THEN 1 ELSE 0 END) as unattempted_count,
            COUNT(qa.id) as total_attempts
        FROM questions q
        $srs_join
        LEFT JOIN question_attempts qa ON q.id = qa.question_id
        WHERE $where_clause
        GROUP BY q.question";

// Add specific mode filters
$having = [];
if ($mode === 'wrong') {
    $having[] = "wrong_count > 0";
} elseif ($mode === 'unattempted') {
    $having[] = "(total_attempts = 0 OR unattempted_count > 0)";
}
// 'mixed' takes everything. We'll balance it in ordering if needed, 
// but priority first is usually enough.

if (!empty($having)) {
    $sql .= " HAVING " . implode(" AND ", $having);
}

// Ordering based on mode to prefer priority questions first
if ($mode === 'mixed') {
    // For mixed, prefer wrong/unattempted over correct if they have same priority
    $sql .= " ORDER BY priority DESC, wrong_count DESC, total_attempts ASC, RAND() LIMIT $limit";
} else {
    $sql .= " ORDER BY priority DESC, RAND() LIMIT $limit";
}

$stmt = $conn->prepare($sql);
if (!empty($params)) {
    $stmt->bind_param($types, ...$params);
}
$stmt->execute();
$result = $stmt->get_result();
$aggregated_questions = $result->fetch_all(MYSQLI_ASSOC);

if (empty($aggregated_questions)) {
    echo json_encode(['success' => false, 'message' => 'No questions found meeting the criteria.']);
    exit;
}

// Now create the exam using the ref_ids
$conn->begin_transaction();
try {
    $display_mode = ucfirst($mode);
    $exam_title = $data['exam_title'] . " (" . $display_mode . ")";
    $q_count = count($aggregated_questions);
    $duration = $q_count;
    $total_marks = $q_count;
    $pass_mark = ceil($total_marks * 0.4);
    
    $insert_exam = $conn->prepare("INSERT INTO exams (subject_id, lesson_id, topic_id, exam_title, duration, total_marks, pass_mark, instructions, negative_mark_value, is_revision) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0.5, 1)");
    $instructions = "Custom performance-based exam focuses on $mode questions. MISSION: MASTER EVERYTHING.";
    $insert_exam->bind_param("iiisidss", $subject_id, $lesson_id, $topic_id, $exam_title, $duration, $total_marks, $pass_mark, $instructions);
    $insert_exam->execute();
    $new_exam_id = $conn->insert_id;
    $insert_exam->close();
    
    $insert_q = $conn->prepare("INSERT INTO questions (subject_id, lesson_id, topic_id, exam_id, question, options, answer, explanation, priority) 
                                 SELECT 
                                    COALESCE(subject_id, ?), 
                                    COALESCE(lesson_id, ?), 
                                    COALESCE(topic_id, ?), 
                                    ?, question, options, answer, explanation, priority 
                                 FROM questions WHERE id = ?");
    
    foreach ($aggregated_questions as $q) {
        $insert_q->bind_param("iiiii", $subject_id, $lesson_id, $topic_id, $new_exam_id, $q['ref_id']);
        $insert_q->execute();
    }
    $insert_q->close();
    
    $conn->commit();
    echo json_encode(['success' => true, 'exam_id' => $new_exam_id]);
} catch (Exception $e) {
    $conn->rollback();
    echo json_encode(['success' => false, 'message' => 'Error: ' . $e->getMessage()]);
}

$conn->close();
?>
