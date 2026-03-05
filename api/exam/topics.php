<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *'); // Consider restricting this in production for security
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
require_once '../subject/db_connect.php';

$lesson_id = isset($_GET['lesson_id']) ? intval($_GET['lesson_id']) : 0;

if ($lesson_id === 0) {
    echo json_encode(['success' => true, 'data' => []]);
    exit;
}

$stmt = $conn->prepare("
    SELECT t.id, t.topic_name, l.is_complete, s.color_class 
    FROM topics t 
    JOIN lessons l ON t.lesson_id = l.id 
    JOIN subjects s ON t.subject_id = s.id 
    WHERE t.lesson_id = ? AND t.is_deleted = 0 
    ORDER BY t.id ASC
");
$stmt->bind_param("i", $lesson_id);
$stmt->execute();
$result = $stmt->get_result();

$topics = [];
while($row = $result->fetch_assoc()) {
    $topics[] = $row;
}

echo json_encode(['success' => true, 'data' => $topics]);
$stmt->close();
$conn->close();
?>
