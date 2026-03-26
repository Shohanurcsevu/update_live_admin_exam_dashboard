<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *'); // Consider restricting this in production for security
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
require_once '../subject/db_connect.php';
require_once '../question/question_utils.php';

$action = isset($_GET['action']) ? $_GET['action'] : 'list';

switch ($action) {
    case 'list': list_exams($conn); break;
    case 'get_single': get_exam($conn); break;
    case 'create': create_exam($conn); break;
    case 'update': update_exam($conn); break;
    case 'delete': delete_exam($conn); break;
    case 'bulk_update': bulk_update_exams($conn); break;
    default: echo json_encode(['success' => false, 'message' => 'Invalid action for exams.']); break;
}
// Helper function to add to the activity log
function log_activity($conn, $type, $message) {
    $stmt = $conn->prepare("INSERT INTO activity_log (activity_type, activity_message) VALUES (?, ?)");
    $stmt->bind_param("ss", $type, $message);
    $stmt->execute();
    $stmt->close();
}

function list_exams($conn) {
    $limit = isset($_GET['limit']) ? intval($_GET['limit']) : (isset($_GET['topic_id']) ? 100 : 10);
    $offset = isset($_GET['offset']) ? intval($_GET['offset']) : 0;

    $where_clauses = [];
    $params = [];
    $types = '';
    
    if (!empty($_GET['subject_id'])) {
        $where_clauses[] = "e.subject_id = ?";
        $params[] = intval($_GET['subject_id']);
        $types .= 'i';
    }
    if (!empty($_GET['lesson_id'])) {
        $where_clauses[] = "e.lesson_id = ?";
        $params[] = intval($_GET['lesson_id']);
        $types .= 'i';
    }
    if (!empty($_GET['topic_id'])) {
        $where_clauses[] = "e.topic_id = ?";
        $params[] = intval($_GET['topic_id']);
        $types .= 'i';
    }
    
    // Date filtering for Timely Model Exam Creator
    // Note: Using updated_at since created_at column doesn't exist
    if (!empty($_GET['from']) && !empty($_GET['to'])) {
        $where_clauses[] = "DATE(e.created_at) BETWEEN ? AND ?";
        $params[] = $_GET['from'];
        $params[] = $_GET['to'];
        $types .= 'ss';
    }


    if (isset($_GET['include_revision']) && $_GET['include_revision'] === 'true') {
        // Do nothing, show both
    } else {
        $where_clauses[] = "e.is_revision = 0";
    }

    if (isset($_GET['exclude_custom']) && $_GET['exclude_custom'] === 'true') {
        $where_clauses[] = "e.subject_id IS NOT NULL";
    }

    $where_clauses[] = "e.is_deleted = 0";
    $where_clauses[] = "e.topic_id IS NOT NULL";
    $where_clauses[] = "e.exam_title NOT LIKE '%Challenge%'";

    $match_select = "";
    $match_join = "";
    if (!empty($_GET['search'])) {
        $searchTerm = '%' . $_GET['search'] . '%';
        $where_clauses[] = "(e.exam_title LIKE ? OR s.subject_name LIKE ? OR l.lesson_name LIKE ? OR t.topic_name LIKE ? OR EXISTS (
            SELECT 1 FROM questions q 
            WHERE q.exam_id = e.id 
            AND q.is_deleted = 0 
            AND (q.question LIKE ? OR q.explanation LIKE ?)
        ))";
        
        $match_select = ", 
            CASE 
                WHEN e.exam_title LIKE ? THEN 'Title'
                WHEN s.subject_name LIKE ? THEN 'Subject'
                WHEN l.lesson_name LIKE ? THEN 'Lesson'
                WHEN t.topic_name LIKE ? THEN 'Topic'
                WHEN mq.question LIKE ? THEN 'Question'
                WHEN mq.explanation LIKE ? THEN 'Explanation'
                ELSE 'Misc'
            END as match_type,
            COALESCE(mq.question, mq.explanation) as match_text";
            
        $match_join = "LEFT JOIN (
            SELECT exam_id, question, explanation 
            FROM questions 
            WHERE is_deleted = 0 
            AND (question LIKE ? OR explanation LIKE ?)
            ORDER BY id ASC
        ) mq ON e.id = mq.exam_id";

        // Parameters for WHERE clause
        $params[] = $searchTerm;
        $params[] = $searchTerm;
        $params[] = $searchTerm;
        $params[] = $searchTerm;
        $params[] = $searchTerm;
        $params[] = $searchTerm;
        $types .= 'ssssss';
        
        // Parameters for SELECT CASE
        $select_params = [$searchTerm, $searchTerm, $searchTerm, $searchTerm, $searchTerm, $searchTerm];
        $select_types = "ssssss";
        
        // Parameters for JOIN mq
        $join_params = [$searchTerm, $searchTerm];
        $join_types = "ss";
    }

    $where_sql = !empty($where_clauses) ? " WHERE " . implode(' AND ', $where_clauses) : "";

    $sql = "SELECT e.*, s.subject_name, s.color_class, l.lesson_name, l.is_complete as lesson_is_complete, t.topic_name,
                   q_count.total_questions,
                   IFNULL(perf.total_attempts, 0) as total_attempts,
                   IFNULL(perf.pass_count, 0) as pass_count,
                   IFNULL(perf.pass_rate, 0) as pass_rate
                   $match_select
            FROM exams e
            LEFT JOIN subjects s ON e.subject_id = s.id
            LEFT JOIN lessons l ON e.lesson_id = l.id
            LEFT JOIN topics t ON e.topic_id = t.id
            $match_join
            LEFT JOIN (
                SELECT exam_id, COUNT(*) as total_questions 
                FROM questions 
                WHERE is_deleted = 0
                GROUP BY exam_id
            ) q_count ON e.id = q_count.exam_id
            LEFT JOIN (
                SELECT 
                    p.exam_id, 
                    COUNT(*) as total_attempts,
                    SUM(CASE WHEN p.score_with_negative >= e2.pass_mark THEN 1 ELSE 0 END) as pass_count,
                    (SUM(CASE WHEN p.score_with_negative >= e2.pass_mark THEN 1 ELSE 0 END) * 100.0 / COUNT(*)) as pass_rate,
                    AVG(p.score_with_negative) as avg_score
                FROM performance p
                JOIN exams e2 ON p.exam_id = e2.id
                WHERE p.id IN (SELECT MAX(id) FROM performance GROUP BY exam_id)
                GROUP BY p.exam_id
            ) perf ON e.id = perf.exam_id
            $where_sql
            GROUP BY e.id";

    // Dynamic Sorting logic
    $allowed_sort_columns = [
        'id' => 'e.id',
        'title' => 'e.exam_title',
        'pass_rate' => 'pass_rate',
        'attempts' => 'total_attempts',
        'duration' => 'e.duration',
        'marks' => 'e.total_marks'
    ];
    
    $sort_by = isset($_GET['sort_by']) && isset($allowed_sort_columns[$_GET['sort_by']]) 
               ? $allowed_sort_columns[$_GET['sort_by']] 
               : 'e.id';
               
    $sort_direction = isset($_GET['sort_direction']) && strtoupper($_GET['sort_direction']) === 'ASC' 
                      ? 'ASC' 
                      : 'DESC';

    $sql .= " ORDER BY $sort_by $sort_direction";
    $sql .= " LIMIT ? OFFSET ?";
    
    $final_params = [];
    $final_types = "";
    
    if (!empty($_GET['search'])) {
        $final_params = array_merge($select_params, $join_params, $params);
        $final_types = $select_types . $join_types . $types;
    } else {
        $final_params = $params;
        $final_types = $types;
    }
    
    $final_params[] = $limit;
    $final_params[] = $offset;
    $final_types .= 'ii';

    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        echo json_encode(['success' => false, 'message' => 'SQL prepare error: ' . $conn->error, 'sql' => $sql]);
        return;
    }
    
    if (!empty($final_params)) {
        $stmt->bind_param($final_types, ...$final_params);
    }
    
    if (!$stmt->execute()) {
        echo json_encode(['success' => false, 'message' => 'SQL execute error: ' . $stmt->error]);
        $stmt->close();
        return;
    }
    
    $result = $stmt->get_result();
    $exams = [];
    while ($row = $result->fetch_assoc()) {
        $exams[] = $row;
    }

    // Get total count for pagination info
    $count_sql = "SELECT COUNT(*) as total FROM exams e 
                  LEFT JOIN subjects s ON e.subject_id = s.id
                  LEFT JOIN lessons l ON e.lesson_id = l.id
                  LEFT JOIN topics t ON e.topic_id = t.id
                  $where_sql";
    $count_stmt = $conn->prepare($count_sql);
    $count_types = $types;
    $count_params = $params;
    if ($count_types !== "") {
        $count_stmt->bind_param($count_types, ...$count_params);
    }
    $count_stmt->execute();
    $total_count = $count_stmt->get_result()->fetch_assoc()['total'];
    
    echo json_encode([
        'success' => true, 
        'data' => $exams,
        'pagination' => [
            'total' => (int)$total_count,
            'limit' => $limit,
            'offset' => $offset,
            'hasMore' => ($offset + $limit) < $total_count
        ]
    ]);
    $stmt->close();
    $count_stmt->close();
}

function get_exam($conn) {
    $id = isset($_GET['id']) ? intval($_GET['id']) : 0;
    // MODIFIED: Use LEFT JOIN here as well to fetch details for custom exams
    $stmt = $conn->prepare("SELECT e.*, s.subject_name, l.lesson_name, t.topic_name 
                            FROM exams e
                            LEFT JOIN subjects s ON e.subject_id = s.id
                            LEFT JOIN lessons l ON e.lesson_id = l.id
                            LEFT JOIN topics t ON e.topic_id = t.id
                            WHERE e.id = ? AND e.is_deleted = 0");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $result = $stmt->get_result();
    echo json_encode(['success' => true, 'data' => $result->fetch_assoc()]);
    $stmt->close();
}

function create_exam($conn) {
    $data = json_decode(file_get_contents('php://input'), true);
    
    $conn->begin_transaction();
    try {
        $stmt = $conn->prepare("INSERT INTO exams (subject_id, lesson_id, topic_id, exam_title, duration, instructions, total_marks, pass_mark, negative_mark_value) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0.5)");
        $stmt->bind_param("iiisissd", $data['subject_id'], $data['lesson_id'], $data['topic_id'], $data['exam_title'], $data['duration'], $data['instructions'], $data['total_marks'], $data['pass_mark']);
        
        if (!$stmt->execute()) {
            throw new Exception("Failed to create exam metadata.");
        }
        
        $exam_id = $conn->insert_id;
        $stmt->close();

        // Handle question importing if provided
        if (!empty($data['questions']) && is_array($data['questions'])) {
            $insert_result = insert_questions($conn, $exam_id, $data['questions']);
            if (!$insert_result['success']) {
                throw new Exception($insert_result['message']);
            }
        }

        $message = "Exam '" . $data['exam_title'] . "' has been created successfully.";
        log_activity($conn, 'Exam Created', $message);
        
        $conn->commit();
        echo json_encode(['success' => true, 'message' => 'Exam and questions created successfully.', 'id' => $exam_id]);
    } catch (Exception $e) {
        $conn->rollback();
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
}

// function update_exam($conn) {
//     $data = json_decode(file_get_contents('php://input'), true);
//     $stmt = $conn->prepare("UPDATE exams SET subject_id = ?, lesson_id = ?, topic_id = ?, exam_title = ?, duration = ?, instructions = ?, total_marks = ?, pass_mark = ? WHERE id = ?");
//     $stmt->bind_param("iiisissdi", $data['subject_id'], $data['lesson_id'], $data['topic_id'], $data['exam_title'], $data['duration'], $data['instructions'], $data['total_marks'], $data['pass_mark'], $data['id']);
//     if ($stmt->execute()) {


//         echo json_encode(['success' => true, 'message' => 'Exam updated successfully.']);
//     } else {
//         echo json_encode(['success' => false, 'message' => 'Failed to update exam.']);
//     }
//     $stmt->close();
// }

function update_exam($conn) {
    $data = json_decode(file_get_contents('php://input'), true);

    // ✅ Step 1: Fetch original exam data
    $stmt_select = $conn->prepare("SELECT * FROM exams WHERE id = ?");
    $stmt_select->bind_param("i", $data['id']);
    $stmt_select->execute();
    $result = $stmt_select->get_result();

    if ($result->num_rows === 0) {
        echo json_encode(['success' => false, 'message' => 'Exam not found.']);
        return;
    }

    $original = $result->fetch_assoc();
    $stmt_select->close();

    // ✅ Step 2: Perform update
    $stmt = $conn->prepare("UPDATE exams SET subject_id = ?, lesson_id = ?, topic_id = ?, exam_title = ?, duration = ?, instructions = ?, total_marks = ?, pass_mark = ? WHERE id = ?");
    $stmt->bind_param(
        "iiisissdi",
        $data['subject_id'],
        $data['lesson_id'],
        $data['topic_id'],
        $data['exam_title'],
        $data['duration'],
        $data['instructions'],
        $data['total_marks'],
        $data['pass_mark'],
        $data['id']
    );
    
    $conn->begin_transaction();
    try {
        if (!$stmt->execute()) {
            throw new Exception("Failed to update exam metadata.");
        }

        // Handle question importing if provided (appends to existing exam)
        if (!empty($data['questions']) && is_array($data['questions'])) {
            $insert_result = insert_questions($conn, $data['id'], $data['questions']);
            if (!$insert_result['success']) {
                throw new Exception($insert_result['message']);
            }
        }
        // ✅ Step 3: Compare fields and prepare log message
        $changes = [];

        if ($data['exam_title'] !== $original['exam_title']) {
            $changes[] = "Title: '" . $original['exam_title'] . "' → '" . $data['exam_title'] . "'";
        }
        if ($data['duration'] != $original['duration']) {
            $changes[] = "Duration: " . $original['duration'] . " → " . $data['duration'] . " mins";
        }
        if ($data['instructions'] !== $original['instructions']) {
            $changes[] = "Instructions updated";
        }
        if ($data['total_marks'] != $original['total_marks']) {
            $changes[] = "Total Marks: " . $original['total_marks'] . " → " . $data['total_marks'];
        }
        if ($data['pass_mark'] != $original['pass_mark']) {
            $changes[] = "Pass Mark: " . $original['pass_mark'] . " → " . $data['pass_mark'];
        }
        if ($data['subject_id'] != $original['subject_id']) {
            $changes[] = "Subject ID: " . $original['subject_id'] . " → " . $data['subject_id'];
        }
        if ($data['lesson_id'] != $original['lesson_id']) {
            $changes[] = "Lesson ID: " . $original['lesson_id'] . " → " . $data['lesson_id'];
        }
        if ($data['topic_id'] != $original['topic_id']) {
            $changes[] = "Topic ID: " . $original['topic_id'] . " → " . $data['topic_id'];
        }

        if (!empty($changes)) {
            $message = "Exam '" . $original['exam_title'] . "' (ID: " . $original['id'] . ") updated. Changes: " . implode("; ", $changes) . ".";
            log_activity($conn, 'Exam Updated', $message);
        }

        $conn->commit();
        echo json_encode(['success' => true, 'message' => 'Exam updated successfully.']);
    } catch (Exception $e) {
        $conn->rollback();
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }

    $stmt->close();
}


// function delete_exam($conn) {
//     $data = json_decode(file_get_contents('php://input'), true);
//     $id = intval($data['id']);
//     $stmt = $conn->prepare("DELETE FROM exams WHERE id = ?");
//     $stmt->bind_param("i", $id);
//     if ($stmt->execute()) {
//         echo json_encode(['success' => true, 'message' => 'Exam deleted successfully.']);
//     } else {
//         echo json_encode(['success' => false, 'message' => 'Failed to delete exam.']);
//     }
//     $stmt->close();
// }

function delete_exam($conn) {
    $data = json_decode(file_get_contents('php://input'), true);

    if (!isset($data['id'])) {
        echo json_encode(['success' => false, 'message' => 'Exam ID not provided.']);
        return;
    }

    $id = intval($data['id']);

    // ✅ Step 1: Fetch exam title before deleting
    $stmt_select = $conn->prepare("SELECT exam_title FROM exams WHERE id = ?");
    $stmt_select->bind_param("i", $id);
    $stmt_select->execute();
    $result = $stmt_select->get_result();

    if ($result->num_rows === 0) {
        echo json_encode(['success' => false, 'message' => 'Exam not found.']);
        $stmt_select->close();
        return;
    }

    $row = $result->fetch_assoc();
    $exam_title = $row['exam_title'];
    $stmt_select->close();

    // ✅ Step 2: Proceed to soft delete
    $stmt = $conn->prepare("UPDATE exams SET is_deleted = 1 WHERE id = ?");
    $stmt->bind_param("i", $id);

    if ($stmt->execute()) {
        if ($stmt->affected_rows > 0) {
            // ✅ Step 3: Cascade soft delete to questions
            $stmt_questions = $conn->prepare("UPDATE questions SET is_deleted = 1 WHERE exam_id = ?");
            $stmt_questions->bind_param("i", $id);
            $stmt_questions->execute();
            $stmt_questions->close();

            $message = "Exam '" . $exam_title . "' (ID: " . $id . ") and its questions have been soft-deleted successfully.";
            log_activity($conn, 'Exam Deleted', $message);
            echo json_encode(['success' => true, 'message' => 'Exam deleted successfully.']);
        } else {
            echo json_encode(['success' => false, 'message' => 'Exam not found or already deleted.']);
        }
    } else {
        echo json_encode(['success' => false, 'message' => 'Error: ' . $stmt->error]);
    }

    $stmt->close();
}


function bulk_update_exams($conn) {
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (empty($data['ids']) || !is_array($data['ids'])) {
        echo json_encode(['success' => false, 'message' => 'No exams selected for bulk update.']);
        return;
    }

    $ids = $data['ids'];
    $subject_id = intval($data['subject_id']);
    $lesson_id = intval($data['lesson_id']);
    $topic_id = intval($data['topic_id']);

    if ($subject_id === 0 || $lesson_id === 0 || $topic_id === 0) {
        echo json_encode(['success' => false, 'message' => 'Invalid target categorization.']);
        return;
    }

    $conn->begin_transaction();
    try {
        // Build the IN clause placeholder
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $sql = "UPDATE exams SET subject_id = ?, lesson_id = ?, topic_id = ? WHERE id IN ($placeholders)";
        $stmt = $conn->prepare($sql);
        
        $types = "iii" . str_repeat("i", count($ids));
        $params = array_merge([$subject_id, $lesson_id, $topic_id], array_map('intval', $ids));
        
        $stmt->bind_param($types, ...$params);
        if (!$stmt->execute()) {
            throw new Exception("Failed to execute bulk update.");
        }
        
        $affected_rows = $stmt->affected_rows;
        $stmt->close();

        $message = "Bulk Re-categorization: Updated categories for " . count($ids) . " exams (Affected: $affected_rows) to Subject ID $subject_id, Lesson ID $lesson_id, Topic ID $topic_id.";
        log_activity($conn, 'Bulk Exam Update', $message);

        $conn->commit();
        echo json_encode(['success' => true, 'message' => "Successfully re-categorized " . count($ids) . " exams."]);
    } catch (Exception $e) {
        $conn->rollback();
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
}

$conn->close();
?>
