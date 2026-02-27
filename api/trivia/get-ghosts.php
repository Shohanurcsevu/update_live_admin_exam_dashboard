<?php
header('Content-Type: application/json');
require_once('../subject/db_connect.php');

// --- Filter Parameters ---
$type = $_GET['source_type'] ?? 'random';
$subject_id = isset($_GET['subject_id']) ? (int)$_GET['subject_id'] : null;
$lesson_id = isset($_GET['lesson_id']) ? (int)$_GET['lesson_id'] : null;
$topic_id = isset($_GET['topic_id']) ? (int)$_GET['topic_id'] : null;
$exam_id = isset($_GET['exam_id']) ? (int)$_GET['exam_id'] : null;

try {
    $where = "WHERE source_type = ?";
    $params = [$type];
    $types = "s";

    if ($type !== 'random') {
        if ($subject_id) { $where .= " AND subject_id = ?"; $params[] = $subject_id; $types .= "i"; }
        else { $where .= " AND subject_id IS NULL"; }

        if ($lesson_id) { $where .= " AND lesson_id = ?"; $params[] = $lesson_id; $types .= "i"; }
        else { $where .= " AND lesson_id IS NULL"; }

        if ($topic_id) { $where .= " AND topic_id = ?"; $params[] = $topic_id; $types .= "i"; }
        else { $where .= " AND topic_id IS NULL"; }

        if ($exam_id) { $where .= " AND exam_id = ?"; $params[] = $exam_id; $types .= "i"; }
        else { $where .= " AND exam_id IS NULL"; }
    }

    // 1. Yesterday's You (Most recent normalized score before today)
    $stmt = $conn->prepare("SELECT normalized_score FROM trivia_snapshots $where AND DATE(created_at) < CURDATE() ORDER BY created_at DESC LIMIT 1");
    $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $yesterday = $stmt->get_result()->fetch_assoc();

    // 2. Best Ever
    $stmt = $conn->prepare("SELECT MAX(normalized_score) as best FROM trivia_snapshots $where");
    $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $best = $stmt->get_result()->fetch_assoc();

    // 3. Personal Average
    $stmt = $conn->prepare("SELECT AVG(normalized_score) as average FROM trivia_snapshots $where");
    $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $average = $stmt->get_result()->fetch_assoc();

    echo json_encode([
        'success' => true,
        'data' => [
            'yesterday' => $yesterday ? (int)$yesterday['normalized_score'] : 400, // Default fallback
            'best' => $best ? (int)$best['best'] : 800,
            'average' => $average ? (int)$average['average'] : 600
        ]
    ]);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>
