<?php
// FILE: api/lesson/toggle-complete.php
// Toggles lesson completion status with optional business rule validation
require_once '../subject/db_connect.php';
header('Content-Type: application/json');

// Ensure POST request
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Invalid request method']);
    exit;
}

// Get input
$data = json_decode(file_get_contents('php://input'), true);
if (!isset($data['id'])) {
    echo json_encode(['success' => false, 'message' => 'Missing lesson id']);
    exit;
}

$lesson_id = intval($data['id']);
$new_status = isset($data['is_complete']) ? intval($data['is_complete']) : -1;
$force = isset($data['force']) ? (bool)$data['force'] : false;
$check_only = isset($data['check_only']) ? (bool)$data['check_only'] : false;

if (!$check_only && ($new_status !== 0 && $new_status !== 1)) {
    echo json_encode(['success' => false, 'message' => 'is_complete must be 0 or 1']);
    exit;
}

// Fetch current lesson info
$stmt = $conn->prepare("SELECT l.*, s.color_class, s.subject_name FROM lessons l JOIN subjects s ON l.subject_id = s.id WHERE l.id = ? AND l.is_deleted = 0");
$stmt->bind_param("i", $lesson_id);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 0) {
    echo json_encode(['success' => false, 'message' => 'Lesson not found']);
    $stmt->close();
    exit;
}

$lesson = $result->fetch_assoc();
$stmt->close();

// --- Topic & Exam Statistics (for the modal) ---
// Count expected topics
$expected_topics = intval($lesson['expected_topics']);

// Count topics with at least 1 non-deleted exam
$check_stmt = $conn->prepare("
    SELECT COUNT(DISTINCT t.id) as topics_with_exams 
    FROM topics t 
    INNER JOIN exams e ON t.id = e.topic_id AND e.is_deleted = 0 
    WHERE t.lesson_id = ? AND t.is_deleted = 0
");
$check_stmt->bind_param("i", $lesson_id);
$check_stmt->execute();
$check_result = $check_stmt->get_result()->fetch_assoc();
$topics_with_exams = intval($check_result['topics_with_exams']);
$check_stmt->close();

// Count created topics
$count_stmt = $conn->prepare("SELECT COUNT(*) as created_topics FROM topics WHERE lesson_id = ? AND is_deleted = 0");
$count_stmt->bind_param("i", $lesson_id);
$count_stmt->execute();
$count_result = $count_stmt->get_result()->fetch_assoc();
$created_topics = intval($count_result['created_topics']);
$count_stmt->close();

$stats = [
    'expected_topics' => $expected_topics,
    'created_topics' => $created_topics,
    'topics_with_exams' => $topics_with_exams
];

// If check_only is passed (for showing the modal), return stats and exit
if (isset($data['check_only']) && $data['check_only']) {
    echo json_encode([
        'success' => true,
        'stats' => $stats,
        'color_class' => $lesson['color_class']
    ]);
    exit;
}

// Perform the update without any business rule validation as requested (manual only)
$completed_at = $new_status === 1 ? date('Y-m-d H:i:s') : null;
$update_stmt = $conn->prepare("UPDATE lessons SET is_complete = ?, completed_at = ? WHERE id = ?");
$update_stmt->bind_param("isi", $new_status, $completed_at, $lesson_id);

if ($update_stmt->execute()) {
    // Log activity
    $status_text = $new_status === 1 ? 'completed' : 'uncompleted';
    $log_stmt = $conn->prepare("INSERT INTO activity_log (activity_type, activity_message) VALUES (?, ?)");
    $activity_type = 'Lesson ' . ucfirst($status_text);
    $activity_message = "Lesson '" . $lesson['lesson_name'] . "' (ID: " . $lesson_id . ") marked as " . $status_text . ".";
    $log_stmt->bind_param("ss", $activity_type, $activity_message);
    $log_stmt->execute();
    $log_stmt->close();

    echo json_encode([
        'success' => true,
        'message' => 'Lesson marked as ' . $status_text,
        'data' => [
            'id' => $lesson_id,
            'is_complete' => $new_status,
            'completed_at' => $completed_at,
            'color_class' => $lesson['color_class'],
            'subject_name' => $lesson['subject_name']
        ]
    ]);
} else {
    echo json_encode(['success' => false, 'message' => 'Failed to update lesson: ' . $update_stmt->error]);
}

$update_stmt->close();
$conn->close();
?>
