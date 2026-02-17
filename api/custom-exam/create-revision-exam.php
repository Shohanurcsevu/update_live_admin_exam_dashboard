<?php
require_once '../subject/db_connect.php';
header('Content-Type: application/json');

$data = json_decode(file_get_contents('php://input'), true);
$topic_id = isset($data['topic_id']) ? intval($data['topic_id']) : null;
$exam_id = isset($data['exam_id']) ? intval($data['exam_id']) : null;
$exam_title = isset($data['exam_title']) ? $conn->real_escape_string($data['exam_title']) : "Revision Exam";
$limit = isset($data['limit']) ? intval($data['limit']) : 15;

if (!$topic_id && !$exam_id) {
    echo json_encode(['success' => false, 'message' => 'Topic ID or Exam ID is required.']);
    exit;
}

// 1. Fetch questions with performance data
$where_clause = $exam_id ? "q.exam_id = ?" : "q.topic_id = ?";
$target_id = $exam_id ?: $topic_id;

$sql = "SELECT 
            q.id as question_id,
            q.priority,
            SUM(CASE WHEN qa.is_correct = 0 THEN 1 ELSE 0 END) as wrong_count,
            COUNT(qa.id) as total_attempts
        FROM questions q
        LEFT JOIN question_attempts qa ON q.id = qa.question_id
        WHERE $where_clause AND q.is_deleted = 0
        GROUP BY q.id
        ORDER BY 
            (CASE WHEN SUM(CASE WHEN qa.is_correct = 0 THEN 1 ELSE 0 END) > 0 THEN 0 ELSE 1 END), -- Wrong first
            (CASE WHEN COUNT(qa.id) = 0 THEN 0 ELSE 1 END), -- Unattempted second
            q.priority DESC, 
            RAND() 
        LIMIT ?";

$stmt = $conn->prepare($sql);
$stmt->bind_param("ii", $target_id, $limit);
$stmt->execute();
$q_result = $stmt->get_result();
$questions = $q_result->fetch_all(MYSQLI_ASSOC);

if (empty($questions)) {
    echo json_encode(['success' => false, 'message' => 'No questions found for this topic.']);
    exit;
}

// 2. Get topic/lesson/subject info for the new exam record
if ($exam_id) {
    $info_stmt = $conn->prepare("SELECT subject_id, lesson_id, topic_id FROM exams WHERE id = ?");
    $info_stmt->bind_param("i", $exam_id);
    $info_stmt->execute();
    $info = $info_stmt->get_result()->fetch_assoc();
    $topic_id = $info['topic_id'];
} else {
    $info_stmt = $conn->prepare("SELECT subject_id, lesson_id FROM topics WHERE id = ?");
    $info_stmt->bind_param("i", $topic_id);
    $info_stmt->execute();
    $info = $info_stmt->get_result()->fetch_assoc();
}

// 3. Create new persistent exam record
$subject_id = $info['subject_id'];
$lesson_id = $info['lesson_id'];
$duration = count($questions);
$total_marks = count($questions);
$pass_mark = $total_marks * 0.99;

$insert_exam_sql = "INSERT INTO exams (subject_id, lesson_id, topic_id, exam_title, duration, total_marks, pass_mark, is_revision) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, 1)";
$ins_stmt = $conn->prepare($insert_exam_sql);
$ins_stmt->bind_param("iiisidd", $subject_id, $lesson_id, $topic_id, $exam_title, $duration, $total_marks, $pass_mark);

if ($ins_stmt->execute()) {
    $new_exam_id = $conn->insert_id;
    
    // 4. Copy questions to the new exam
    $copy_stmt = $conn->prepare("INSERT INTO questions (exam_id, subject_id, lesson_id, topic_id, question, options, answer, explanation, priority) 
                                 SELECT ?, subject_id, lesson_id, topic_id, question, options, answer, explanation, priority 
                                 FROM questions WHERE id = ?");
    
    foreach ($questions as $q) {
        $qid = $q['question_id'];
        $copy_stmt->bind_param("ii", $new_exam_id, $qid);
        $copy_stmt->execute();
    }
    
    echo json_encode([
        'success' => true, 
        'message' => 'Revision exam created successfully.',
        'exam_id' => $new_exam_id
    ]);
} else {
    echo json_encode(['success' => false, 'message' => 'Failed to create exam record.']);
}

$conn->close();
?>
