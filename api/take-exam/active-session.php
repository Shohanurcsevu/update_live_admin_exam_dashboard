<?php
header('Content-Type: application/json');
require_once '../subject/db_connect.php';

$action = $_GET['action'] ?? '';

switch ($action) {
    case 'check':
        // Check for any ACTIVE session
        $stmt = $conn->prepare("SELECT id, exam_id, exam_title, start_time FROM active_exam_sessions WHERE status = 'ACTIVE' LIMIT 1");
        $stmt->execute();
        $result = $stmt->get_result();
        $session = $result->fetch_assoc();
        
        echo json_encode(['success' => true, 'session' => $session]);
        break;

    case 'start':
        $data = json_decode(file_get_contents('php://input'), true);
        $exam_id = intval($data['exam_id'] ?? 0);
        $exam_title = $data['exam_title'] ?? 'Unknown Exam';

        if ($exam_id <= 0) {
            echo json_encode(['success' => false, 'message' => 'Invalid Exam ID']);
            exit;
        }

        // Cancel any existing active sessions first (safety)
        $conn->query("UPDATE active_exam_sessions SET status = 'CANCELLED' WHERE status = 'ACTIVE'");

        $stmt = $conn->prepare("INSERT INTO active_exam_sessions (exam_id, exam_title, status) VALUES (?, ?, 'ACTIVE')");
        $stmt->bind_param("is", $exam_id, $exam_title);
        
        if ($stmt->execute()) {
            echo json_encode(['success' => true, 'session_id' => $conn->insert_id]);
        } else {
            echo json_encode(['success' => false, 'message' => $conn->error]);
        }
        break;

    case 'complete':
        $data = json_decode(file_get_contents('php://input'), true);
        $exam_id = intval($data['exam_id'] ?? 0);

        if ($exam_id <= 0) {
            echo json_encode(['success' => false, 'message' => 'Invalid Exam ID']);
            exit;
        }

        $stmt = $conn->prepare("UPDATE active_exam_sessions SET status = 'COMPLETED' WHERE exam_id = ? AND status = 'ACTIVE'");
        $stmt->bind_param("i", $exam_id);
        $stmt->execute();
        
        echo json_encode(['success' => true]);
        break;

    case 'cancel':
        $data = json_decode(file_get_contents('php://input'), true);
        $session_id = intval($data['session_id'] ?? 0);

        if ($session_id > 0) {
            $stmt = $conn->prepare("UPDATE active_exam_sessions SET status = 'CANCELLED' WHERE id = ?");
            $stmt->bind_param("i", $session_id);
        } else {
            // Cancel all active (emergency reset)
            $stmt = $conn->prepare("UPDATE active_exam_sessions SET status = 'CANCELLED' WHERE status = 'ACTIVE'");
        }
        
        $stmt->execute();
        echo json_encode(['success' => true]);
        break;

    default:
        echo json_encode(['success' => false, 'message' => 'Invalid action']);
        break;
}

$conn->close();
?>
