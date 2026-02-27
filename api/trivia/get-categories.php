<?php
header('Content-Type: application/json');
require_once('../subject/db_connect.php');

$type = $_GET['type'] ?? 'all';
$subject_id = isset($_GET['subject_id']) ? (int)$_GET['subject_id'] : null;
$lesson_id = isset($_GET['lesson_id']) ? (int)$_GET['lesson_id'] : null;
$topic_id = isset($_GET['topic_id']) ? (int)$_GET['topic_id'] : null;

try {
    $data = [];

    if ($type === 'all' || $type === 'subjects') {
        $res = $conn->query("SELECT id, subject_name as name FROM subjects WHERE is_deleted = 0 ORDER BY id ASC");
        $data['subjects'] = [];
        while($row = $res->fetch_assoc()) $data['subjects'][] = $row;
    }

    if ($type === 'all' || $type === 'lessons') {
        $where = "WHERE is_deleted = 0";
        if ($subject_id) $where .= " AND subject_id = $subject_id";
        $res = $conn->query("SELECT id, lesson_name as name FROM lessons $where ORDER BY lesson_name ASC");
        $data['lessons'] = [];
        while($row = $res->fetch_assoc()) $data['lessons'][] = $row;
    }

    if ($type === 'all' || $type === 'topics') {
        $where = "WHERE is_deleted = 0";
        if ($subject_id) $where .= " AND subject_id = $subject_id";
        if ($lesson_id) $where .= " AND lesson_id = $lesson_id";
        $res = $conn->query("SELECT id, topic_name as name FROM topics $where ORDER BY topic_name ASC");
        $data['topics'] = [];
        while($row = $res->fetch_assoc()) $data['topics'][] = $row;
    }

    if ($type === 'all' || $type === 'exams') {
        $where = "WHERE is_deleted = 0";
        if ($subject_id) $where .= " AND subject_id = $subject_id";
        if ($lesson_id) $where .= " AND lesson_id = $lesson_id";
        if ($topic_id) $where .= " AND topic_id = $topic_id";
        $res = $conn->query("SELECT id, exam_title as name FROM exams $where AND subject_id IS NOT NULL AND is_revision = 0 ORDER BY created_at DESC LIMIT 100");
        $data['exams'] = [];
        while($row = $res->fetch_assoc()) $data['exams'][] = $row;
    }

    echo json_encode(['success' => true, 'data' => $data]);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>
