<?php
require_once '../subject/db_connect.php';

$data = json_decode(file_get_contents("php://input"), true);

if (empty($data['id'])) {
    echo json_encode(['success' => false, 'message' => 'Question ID is required.']);
    exit;
}

$id = intval($data['id']);
$question_text = $data['question'];
$options_json = json_encode($data['options']);
$answer = $data['answer'];
$explanation = $data['explanation'];

// Function to get single column value by table and id
function get_name_by_id($conn, $table, $id, $column) {
    $stmt = $conn->prepare("SELECT $column FROM $table WHERE id = ?");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $result = $stmt->get_result();
    $name = '';
    if ($result->num_rows > 0) {
        $row = $result->fetch_assoc();
        $name = $row[$column];
    }
    $stmt->close();
    return $name;
}

// Fetch exam_id for this question
$stmt_exam = $conn->prepare("SELECT exam_id FROM questions WHERE id = ?");
$stmt_exam->bind_param("i", $id);
$stmt_exam->execute();
$result_exam = $stmt_exam->get_result();
if ($result_exam->num_rows === 0) {
    echo json_encode(['success' => false, 'message' => 'Question not found.']);
    exit;
}
$row_exam = $result_exam->fetch_assoc();
$exam_id = $row_exam['exam_id'];
$stmt_exam->close();

// Fetch exam details
$stmt = $conn->prepare("SELECT exam_title, subject_id, lesson_id FROM exams WHERE id = ?");
$stmt->bind_param("i", $exam_id);
$stmt->execute();
$result = $stmt->get_result();
if ($result->num_rows === 0) {
    echo json_encode(['success' => false, 'message' => 'Exam not found.']);
    exit;
}
$exam = $result->fetch_assoc();
$stmt->close();

$exam_title = $exam['exam_title'];
$subject_name = get_name_by_id($conn, 'subjects', $exam['subject_id'], 'subject_name');
$lesson_name = get_name_by_id($conn, 'lessons', $exam['lesson_id'], 'lesson_name');

$stmt_update = $conn->prepare("UPDATE questions SET question = ?, options = ?, answer = ?, explanation = ? WHERE id = ?");
$stmt_update->bind_param("ssssi", $question_text, $options_json, $answer, $explanation, $id);

function log_activity($conn, $type, $message) {
    $stmt_log = $conn->prepare("INSERT INTO activity_log (activity_type, activity_message) VALUES (?, ?)");
    $stmt_log->bind_param("ss", $type, $message);
    $stmt_log->execute();
    $stmt_log->close();
}

if ($stmt_update->execute()) {
    // Log with exam, subject, lesson info
    $msg = "Question ID {$id} was updated in Exam '{$exam_title}' (Subject: '{$subject_name}', Lesson: '{$lesson_name}'). New question: '" . substr($question_text, 0, 50) . (strlen($question_text) > 50 ? "..." : "") . "'";
    log_activity($conn, 'Question Updated', $msg);

    echo json_encode(['success' => true, 'message' => 'Question updated successfully.']);
} else {
    echo json_encode(['success' => false, 'message' => 'Failed to update question.']);
}

$stmt_update->close();
$conn->close();
?>
