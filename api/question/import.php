<?php

require_once '../subject/db_connect.php';
require_once 'question_utils.php';

$data = json_decode(file_get_contents("php://input"), true);

if (empty($data['exam_id']) || empty($data['questions']) || !is_array($data['questions'])) {
    echo json_encode(['success' => false, 'message' => 'Exam ID and questions array are required.']);
    exit;
}

$exam_id = intval($data['exam_id']);
$questions = $data['questions'];

$conn->begin_transaction();
$result = insert_questions($conn, $exam_id, $questions);

if ($result['success']) {
    $conn->commit();
    echo json_encode(['success' => true, 'message' => 'Questions imported successfully.']);
} else {
    $conn->rollback();
    echo json_encode(['success' => false, 'message' => $result['message']]);
}

$conn->close();
?>
