<?php
// FILE: api/custom-exam/presets.php
// CRUD API for lesson-wise exam presets

require_once '../subject/db_connect.php';

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        handleGet($conn);
        break;
    case 'POST':
        handlePost($conn);
        break;
    case 'PUT':
        handlePut($conn);
        break;
    case 'DELETE':
        handleDelete($conn);
        break;
    default:
        echo json_encode(['success' => false, 'message' => 'Method not allowed']);
        break;
}

$conn->close();

function handleGet($conn) {
    $result = $conn->query("SELECT * FROM exam_presets ORDER BY updated_at DESC");
    $presets = [];
    while ($row = $result->fetch_assoc()) {
        $lessons_data = json_decode($row['lessons_data'], true);
        $total_unseen = 0;
        
        if (!empty($lessons_data)) {
            $lesson_ids = array_map(function($l) { return intval($l['lesson_id']); }, $lessons_data);
            $ids_placeholder = implode(',', $lesson_ids);
            
            // Get total unseen questions for these lessons
            $unseen_res = $conn->query("
                SELECT (COUNT(DISTINCT q.id) - COUNT(DISTINCT qa.question_id)) as unseen_count
                FROM questions q
                LEFT JOIN question_attempts qa ON q.id = qa.question_id
                WHERE q.lesson_id IN ($ids_placeholder) AND q.is_deleted = 0 AND q.original_question_id IS NULL
            ");
            if ($unseen_res) {
                $unseen_data = $unseen_res->fetch_assoc();
                $total_unseen = intval($unseen_data['unseen_count']);
            }
        }
        
        $row['lessons_data'] = $lessons_data;
        $row['total_unseen'] = $total_unseen;
        $presets[] = $row;
    }
    echo json_encode(['success' => true, 'data' => $presets]);
}

// --- POST: Create a new preset ---
function handlePost($conn) {
    $data = json_decode(file_get_contents("php://input"), true);

    if (empty($data['preset_name']) || empty($data['lessons_data'])) {
        echo json_encode(['success' => false, 'message' => 'Preset name and lessons data are required.']);
        return;
    }

    $preset_name = trim($data['preset_name']);
    $lessons_data = json_encode($data['lessons_data']);

    $stmt = $conn->prepare("INSERT INTO exam_presets (preset_name, lessons_data) VALUES (?, ?)");
    $stmt->bind_param("ss", $preset_name, $lessons_data);

    if ($stmt->execute()) {
        $new_id = $conn->insert_id;
        $stmt->close();
        echo json_encode(['success' => true, 'message' => 'Preset created successfully.', 'data' => ['id' => $new_id]]);
    } else {
        $stmt->close();
        echo json_encode(['success' => false, 'message' => 'Failed to create preset.']);
    }
}

// --- PUT: Update an existing preset ---
function handlePut($conn) {
    $data = json_decode(file_get_contents("php://input"), true);

    if (empty($data['id']) || empty($data['preset_name']) || empty($data['lessons_data'])) {
        echo json_encode(['success' => false, 'message' => 'Preset ID, name, and lessons data are required.']);
        return;
    }

    $id = intval($data['id']);
    $preset_name = trim($data['preset_name']);
    $lessons_data = json_encode($data['lessons_data']);

    $stmt = $conn->prepare("UPDATE exam_presets SET preset_name = ?, lessons_data = ? WHERE id = ?");
    $stmt->bind_param("ssi", $preset_name, $lessons_data, $id);

    if ($stmt->execute()) {
        $stmt->close();
        echo json_encode(['success' => true, 'message' => 'Preset updated successfully.']);
    } else {
        $stmt->close();
        echo json_encode(['success' => false, 'message' => 'Failed to update preset.']);
    }
}

// --- DELETE: Delete a preset ---
function handleDelete($conn) {
    $data = json_decode(file_get_contents("php://input"), true);

    if (empty($data['id'])) {
        echo json_encode(['success' => false, 'message' => 'Preset ID is required.']);
        return;
    }

    $id = intval($data['id']);

    $stmt = $conn->prepare("DELETE FROM exam_presets WHERE id = ?");
    $stmt->bind_param("i", $id);

    if ($stmt->execute()) {
        $stmt->close();
        echo json_encode(['success' => true, 'message' => 'Preset deleted successfully.']);
    } else {
        $stmt->close();
        echo json_encode(['success' => false, 'message' => 'Failed to delete preset.']);
    }
}
?>
