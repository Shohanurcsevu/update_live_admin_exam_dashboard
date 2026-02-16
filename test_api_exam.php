<?php
header('Content-Type: application/json');
require_once 'api/subject/db_connect.php';

// Mock GET parameters
$_GET['limit'] = 20;
$_GET['offset'] = 0;
// $_GET['subject_id'] = ...; 

function list_exams($conn) {
    $limit = isset($_GET['limit']) ? intval($_GET['limit']) : 10;
    $offset = isset($_GET['offset']) ? intval($_GET['offset']) : 0;

    $where_clauses = [];
    $params = [];
    $types = '';
    
    if (!empty($_GET['subject_id'])) {
        $where_clauses[] = "e.subject_id = ?";
        $params[] = intval($_GET['subject_id']);
        $types .= 'i';
    }
    
    // Filter out custom exams (those not linked to full hierarchy)
    $where_clauses[] = "e.subject_id IS NOT NULL";
    $where_clauses[] = "e.lesson_id IS NOT NULL";
    $where_clauses[] = "e.topic_id IS NOT NULL";
    $where_clauses[] = "e.is_deleted = 0";
    $where_sql = !empty($where_clauses) ? " WHERE " . implode(' AND ', $where_clauses) : "";

    $sql = "SELECT e.*, s.subject_name, l.lesson_name, t.topic_name,
                   q_count.total_questions
            FROM exams e
            LEFT JOIN subjects s ON e.subject_id = s.id
            LEFT JOIN lessons l ON e.lesson_id = l.id
            LEFT JOIN topics t ON e.topic_id = t.id
            LEFT JOIN (
                SELECT exam_id, COUNT(*) as total_questions 
                FROM questions 
                WHERE is_deleted = 0
                GROUP BY exam_id
            ) q_count ON e.id = q_count.exam_id
            $where_sql
            ORDER BY e.id DESC
            LIMIT ? OFFSET ?";
    
    $params[] = $limit;
    $params[] = $offset;
    $types .= 'ii';

    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        echo json_encode(['success' => false, 'message' => 'SQL prepare error: ' . $conn->error, 'sql' => $sql]);
        return;
    }
    
    if (!empty($params)) {
        $stmt->bind_param($types, ...$params);
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

    echo json_encode([
        'success' => true, 
        'data' => $exams,
        'count' => count($exams)
    ], JSON_PRETTY_PRINT);
}

list_exams($conn);
?>
