<?php
// FILE: api/take-exam/start.php (Corrected)
// This file is called when you click "Take Exam".

require_once '../subject/db_connect.php';
if (empty($_GET['exam_id'])) {
    echo json_encode(['success' => false, 'message' => 'Exam ID required.']);
    exit;

}
$exam_id = intval($_GET['exam_id']);

// --- MODIFIED: Changed JOINs to LEFT JOINs to support exams with NULL topic_id ---
$exam_sql = "SELECT e.*, s.subject_name, l.lesson_name, t.topic_name 
             FROM exams e 
             LEFT JOIN subjects s ON e.subject_id = s.id 
             LEFT JOIN lessons l ON e.lesson_id = l.id 
             LEFT JOIN topics t ON e.topic_id = t.id 
             WHERE e.id = ? AND e.is_deleted = 0";

$stmt = $conn->prepare($exam_sql);
$stmt->bind_param("i", $exam_id);
$stmt->execute();
$exam_details = $stmt->get_result()->fetch_assoc();

if (!$exam_details) {
    echo json_encode(['success' => false, 'message' => 'Exam not found.']);
    exit;

}

// --- NEW: Dynamic Question Counts ---
if (isset($_GET['action'])) {
    if ($_GET['action'] === 'get_counts') {
        $count_sql = "SELECT priority, COUNT(*) as count FROM questions WHERE exam_id = ? AND is_deleted = 0 GROUP BY priority";
        $stmt = $conn->prepare($count_sql);
        $stmt->bind_param("i", $exam_id);
        $stmt->execute();
        $result = $stmt->get_result();
        $counts = ["0" => 0, "1" => 0, "2" => 0, "3" => 0];
        while ($row = $result->fetch_assoc()) {
            $counts[strval($row['priority'])] = intval($row['count']);
        }
        echo json_encode(['success' => true, 'data' => $counts]);
        exit;
    }

    if ($_GET['action'] === 'check') {
        $priorities = isset($_GET['priorities']) ? explode(',', $_GET['priorities']) : [];
        $priorities = array_filter($priorities, function ($val) {
            return $val !== ''; });
        $priorities = array_unique(array_map('intval', $priorities));

        $count_sql = "SELECT COUNT(*) as total FROM questions WHERE exam_id = ? AND is_deleted = 0";
        if (!empty($priorities)) {
            $placeholders = implode(',', array_fill(0, count($priorities), '?'));
            $count_sql .= " AND priority IN ($placeholders)";
        }

        $stmt = $conn->prepare($count_sql);
        $bind_types = "i" . str_repeat("i", count($priorities));
        $bind_params = array_merge([$exam_id], $priorities);

        $stmt->bind_param($bind_types, ...$bind_params);
        $stmt->execute();
        $count = $stmt->get_result()->fetch_assoc()['total'];

        echo json_encode(['success' => true, 'count' => intval($count)]);
        exit;
    }
}

$num_questions = isset($_GET['num_questions']) ? intval($_GET['num_questions']) : 0;
$priorities = isset($_GET['priorities']) ? explode(',', $_GET['priorities']) : [];
$priorities = array_filter($priorities, function ($val) {
    return $val !== ''; });
$priorities = array_unique(array_map('intval', $priorities));

// --- NEW: Fair Selection Logic for Mixed Exams ---
$is_diverse = false;
$source_ids = [];
if ($num_questions > 0) {
    // Detect source diversity
    $diverse_sql = "SELECT DISTINCT COALESCE(parent.exam_id, q.exam_id) as source_id 
                    FROM questions q 
                    LEFT JOIN questions parent ON q.original_question_id = parent.id 
                    WHERE q.exam_id = ? AND q.is_deleted = 0";
    $diverse_stmt = $conn->prepare($diverse_sql);
    $diverse_stmt->bind_param("i", $exam_id);
    $diverse_stmt->execute();
    $diverse_res = $diverse_stmt->get_result();
    $source_map = [];
    while ($row = $diverse_res->fetch_assoc()) {
        if ($row['source_id']) $source_map[$row['source_id']] = true;
    }
    $source_ids = array_keys($source_map);
    if (count($source_ids) > 1) {
        $is_diverse = true;
    }
    $diverse_stmt->close();
}

if ($is_diverse) {
    // 1. Calculate Fair Quota
    $num_sources = count($source_ids);
    $limit_per_source = ceil($num_questions / $num_sources);

    // 2. Build the Common Table Expression (CTE) for Fair Selection
    // We use ROW_NUMBER() to rank questions WITHIN each source exam.
    // Order: Unattempted (total_attempts=0) first, then Wrongly answered (wrong_count > 0) second, then Random.
    $priority_filter = "";
    if (!empty($priorities)) {
        $priority_placeholders = implode(',', array_fill(0, count($priorities), '?'));
        $priority_filter = " AND q.priority IN ($priority_placeholders)";
    }

    $partition_sql = "
        WITH RankedQuestions AS (
            SELECT 
                q.id, q.subject_id, q.lesson_id, q.topic_id, q.question, q.options, q.answer, q.explanation, q.priority, q.original_question_id,
                COALESCE(parent.exam_id, q.exam_id) as source_exam_id,
                COUNT(qa.id) as taken_count,
                SUM(CASE WHEN qa.is_correct = 0 AND qa.selected_answer IS NOT NULL THEN 1 ELSE 0 END) as wrong_count,
                ROW_NUMBER() OVER (
                    PARTITION BY COALESCE(parent.exam_id, q.exam_id) 
                    ORDER BY 
                        (CASE WHEN COUNT(qa.selected_answer) = 0 THEN 0 ELSE 1 END) ASC, -- Unattempted First (Skips don't count)
                        SUM(CASE WHEN qa.is_correct = 0 AND qa.selected_answer IS NOT NULL THEN 1 ELSE 0 END) DESC, -- Failed Second
                        RAND() -- Variety Third
                ) as rn
            FROM questions q
            LEFT JOIN questions parent ON q.original_question_id = parent.id
            LEFT JOIN questions root ON parent.original_question_id = root.id
            LEFT JOIN question_attempts qa ON qa.question_id IN (q.id, q.original_question_id, parent.original_question_id)
            WHERE q.exam_id = ? AND q.is_deleted = 0 $priority_filter
            GROUP BY q.id
        )
        SELECT * FROM RankedQuestions
        WHERE rn <= ?
        ORDER BY RAND()
        LIMIT ?";

    $stmt = $conn->prepare($partition_sql);
    $bind_types = "i";
    $bind_params = [$exam_id];

    if (!empty($priorities)) {
        $bind_types .= str_repeat("i", count($priorities));
        foreach ($priorities as $p) $bind_params[] = $p;
    }

    $bind_types .= "ii";
    $bind_params[] = $limit_per_source;
    $bind_params[] = $num_questions;

    $stmt->bind_param($bind_types, ...$bind_params);
} else {
    // Standard Global Selection
    $question_sql = "SELECT q.id, q.subject_id, q.lesson_id, q.topic_id, q.question, q.options, q.answer, q.explanation, q.priority, q.original_question_id,
                     COUNT(qa.selected_answer) as taken_count, 
                     SUM(CASE WHEN qa.is_correct = 1 THEN 1 ELSE 0 END) as correct_count,
                     SUM(CASE WHEN qa.is_correct = 0 AND qa.selected_answer IS NOT NULL THEN 1 ELSE 0 END) as wrong_count
                      FROM questions q
                      LEFT JOIN questions parent ON q.original_question_id = parent.id
                      LEFT JOIN questions root ON parent.original_question_id = root.id
                      LEFT JOIN question_attempts qa ON qa.question_id IN (q.id, q.original_question_id, parent.original_question_id)
                      WHERE q.exam_id = ? AND q.is_deleted = 0";

    if (!empty($priorities)) {
        $placeholders = implode(',', array_fill(0, count($priorities), '?'));
        $question_sql .= " AND q.priority IN ($placeholders)";
    }

    $question_sql .= " GROUP BY q.id";

    // Standard ordering (Intelligent Prioritization built-in)
    $question_sql .= " ORDER BY ";
    if (isset($_GET['sort']) && $_GET['sort'] === 'least_attempted') {
        $question_sql .= "taken_count ASC, ";
    } else {
        // ALWAYS prioritize unattempted, then failed, then random
        $question_sql .= "(CASE WHEN COUNT(qa.selected_answer) = 0 THEN 0 ELSE 1 END) ASC, ";
        $question_sql .= "wrong_count DESC, ";
    }
    
    if ($num_questions > 0) {
        $question_sql .= " RAND() LIMIT ?";
    } else {
        $question_sql .= " RAND()"; 
    }

    $stmt = $conn->prepare($question_sql);
    $bind_types = "i";
    $bind_params = [$exam_id];

    if (!empty($priorities)) {
        $bind_types .= str_repeat("i", count($priorities));
        foreach ($priorities as $p) $bind_params[] = $p;
    }

    if ($num_questions > 0) {
        $bind_types .= "i";
        $bind_params[] = $num_questions;
    }

    $stmt->bind_param($bind_types, ...$bind_params);
}

$stmt->execute();
$result = $stmt->get_result();
$questions = [];
while ($row = $result->fetch_assoc()) {
    $row['options'] = json_decode($row['options'], true);
    $questions[] = $row;
}

echo json_encode(['success' => true, 'data' => ['details' => $exam_details, 'questions' => $questions, 'mode' => $is_diverse ? 'fair_distribution' : 'standard']]);
$stmt->close();
$conn->close();
?>
