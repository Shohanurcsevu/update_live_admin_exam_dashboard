<?php
// FILE: api/take-exam/presets.php
require_once '../subject/db_connect.php';

$method = $_SERVER['REQUEST_METHOD'];

// GET: Fetch all presets
if ($method === 'GET') {
    $sql = "SELECT * FROM exam_setup_presets ORDER BY created_at ASC";
    $result = $conn->query($sql);
    $presets = [];
    while ($row = $result->fetch_assoc()) {
        $presets[] = $row;
    }
    echo json_encode(['success' => true, 'data' => $presets]);
    exit;
}

// POST: Save a new preset
if ($method === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (empty($data['name'])) {
        echo json_encode(['success' => false, 'message' => 'Preset name required.']);
        exit;
    }
    
    $name = $conn->real_escape_string($data['name']);
    $num_questions = isset($data['num_questions']) ? intval($data['num_questions']) : null;
    $priorities = isset($data['priorities']) ? $conn->real_escape_string($data['priorities']) : null;
    
    $stmt = $conn->prepare("INSERT INTO exam_setup_presets (name, num_questions, priorities) VALUES (?, ?, ?)");
    $stmt->bind_param("sis", $name, $num_questions, $priorities);
    
    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'message' => 'Preset saved successfully!', 'id' => $conn->insert_id]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Failed to save preset.']);
    }
    exit;
}

// DELETE: Remove a preset
if ($method === 'DELETE') {
    $data = json_decode(file_get_contents('php://input'), true);
    if (empty($data['id'])) {
        echo json_encode(['success' => false, 'message' => 'Preset ID required.']);
        exit;
    }
    
    $id = intval($data['id']);
    $stmt = $conn->prepare("DELETE FROM exam_setup_presets WHERE id = ?");
    $stmt->bind_param("i", $id);
    
    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'message' => 'Preset deleted.']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Failed to delete preset.']);
    }
    exit;
}

$conn->close();
?>
