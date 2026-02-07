<?php
/**
 * Add Mistakes API
 * 
 * Records incorrect question IDs into the Mistake Bank.
 */

require_once '../subject/db_connect.php';
header('Content-Type: application/json');

$data = json_decode(file_get_contents("php://input"), true);

if (empty($data['questions']) || !is_array($data['questions'])) {
    echo json_encode(['success' => false, 'message' => 'No questions provided.']);
    exit;
}

$exam_id = isset($data['exam_id']) ? intval($data['exam_id']) : null;
$is_custom = isset($data['is_custom']) ? intval($data['is_custom']) : 0;
$is_offline = isset($data['is_offline']) ? intval($data['is_offline']) : 0;

$success_count = 0;
$errors = [];

foreach ($data['questions'] as $q) {
    if (empty($q['question_id'])) continue;

    $q_id = intval($q['question_id']);
    $sub_id = isset($q['subject_id']) ? intval($q['subject_id']) : null;
    $les_id = isset($q['lesson_id']) ? intval($q['lesson_id']) : null;
    $top_id = isset($q['topic_id']) ? intval($q['topic_id']) : null;

    // Insert or Increment mistake count
    // Now tracking per question PER EXAM
    $check = $conn->prepare("SELECT id, mistake_count FROM mistake_bank WHERE question_id = ? AND exam_id " . ($exam_id === null ? "IS NULL" : "= ?"));
    
    if ($exam_id === null) {
        $check->bind_param("i", $q_id);
    } else {
        $check->bind_param("ii", $q_id, $exam_id);
    }
    
    $check->execute();
    $result = $check->get_result();

    if ($result->num_rows > 0) {
        $row = $result->fetch_assoc();
        $new_count = $row['mistake_count'] + 1;
        $stmt = $conn->prepare("UPDATE mistake_bank SET mistake_count = ?, resolved = 0, last_missed_at = NOW() WHERE question_id = ? AND exam_id " . ($exam_id === null ? "IS NULL" : "= ?"));
        if ($exam_id === null) {
            $stmt->bind_param("ii", $new_count, $q_id);
        } else {
            $stmt->bind_param("iii", $new_count, $q_id, $exam_id);
        }
    } else {
        $stmt = $conn->prepare("INSERT INTO mistake_bank (question_id, exam_id, subject_id, lesson_id, topic_id, is_custom, is_offline, mistake_count) VALUES (?, ?, ?, ?, ?, ?, ?, 1)");
        $stmt->bind_param("iiiiiii", $q_id, $exam_id, $sub_id, $les_id, $top_id, $is_custom, $is_offline);
    }

    if ($stmt->execute()) {
        $success_count++;
    } else {
        $errors[] = $conn->error;
    }
    $stmt->close();
}

echo json_encode([
    'success' => true,
    'message' => "Recorded $success_count mistakes.",
    'errors' => $errors
]);

$conn->close();
?>
