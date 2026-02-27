<?php
header('Content-Type: application/json');
require_once('../subject/db_connect.php');

try {
    // 1. Yesterday's You (Most recent normalized score before today)
    $stmt = $conn->prepare("SELECT normalized_score FROM trivia_snapshots WHERE DATE(created_at) < CURDATE() ORDER BY created_at DESC LIMIT 1");
    $stmt->execute();
    $yesterday = $stmt->get_result()->fetch_assoc();

    // 2. Best Ever
    $stmt = $conn->prepare("SELECT MAX(normalized_score) as best FROM trivia_snapshots");
    $stmt->execute();
    $best = $stmt->get_result()->fetch_assoc();

    // 3. Personal Average
    $stmt = $conn->prepare("SELECT AVG(normalized_score) as average FROM trivia_snapshots");
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
