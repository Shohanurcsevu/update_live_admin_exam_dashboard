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
    $type = !empty($_GET['type']) ? $_GET['type'] : 'lesson';
    $stmt = $conn->prepare("SELECT * FROM exam_presets WHERE type = ? ORDER BY updated_at DESC");
    $stmt->bind_param("s", $type);
    $stmt->execute();
    $result = $stmt->get_result();
    $presets = [];
    while ($row = $result->fetch_assoc()) {
        $lessons_data = json_decode($row['lessons_data'], true);
        $total_unseen = 0;
        
        if (!empty($lessons_data)) {
            $id_key = ($type === 'topic') ? 'topic_id' : 'lesson_id';
            $id_column = ($type === 'topic') ? 'topic_id' : 'lesson_id';
            
            // HYDRATION: For topic presets, ensure each topic has lesson_id and subject_id
            if ($type === 'topic') {
                $hydration_needed = false;
                foreach ($lessons_data as $l) {
                    if (empty($l['lesson_id']) || empty($l['subject_id'])) {
                        $hydration_needed = true;
                        break;
                    }
                }

                if ($hydration_needed) {
                    foreach ($lessons_data as &$l) {
                        if (!empty($l['topic_id']) && (empty($l['lesson_id']) || empty($l['subject_id']))) {
                            $tid = intval($l['topic_id']);
                            $lookup = $conn->query("SELECT lesson_id, subject_id FROM questions WHERE topic_id = $tid AND is_deleted = 0 LIMIT 1");
                            if ($lookup && $row_ids = $lookup->fetch_assoc()) {
                                $l['lesson_id'] = $row_ids['lesson_id'];
                                $l['subject_id'] = $row_ids['subject_id'];
                            }
                        }
                    }
                    unset($l);
                }
            }

            $ids = array_map(function($l) use ($id_key) { 
                return isset($l[$id_key]) ? intval($l[$id_key]) : 0; 
            }, $lessons_data);
            $ids = array_filter($ids);
            
            if (!empty($ids)) {
                $ids_placeholder = implode(',', $ids);
                
                // Get total unseen questions for these lessons/topics
                $unseen_res = $conn->query("
                    SELECT (COUNT(DISTINCT q.id) - COUNT(DISTINCT qa.question_id)) as unseen_count
                    FROM questions q
                    LEFT JOIN question_attempts qa ON q.id = qa.question_id
                    WHERE q.$id_column IN ($ids_placeholder) AND q.is_deleted = 0 AND q.original_question_id IS NULL
                ");
                if ($unseen_res) {
                    $unseen_data = $unseen_res->fetch_assoc();
                    $total_unseen = intval($unseen_data['unseen_count']);
                }
            }
        }
        
        $row['lessons_data'] = $lessons_data;
        $row['total_unseen'] = $total_unseen;
        $presets[] = $row;
    }
    $stmt->close();
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
    $type = !empty($data['type']) ? $data['type'] : 'lesson';

    $stmt = $conn->prepare("INSERT INTO exam_presets (preset_name, lessons_data, type) VALUES (?, ?, ?)");
    $stmt->bind_param("sss", $preset_name, $lessons_data, $type);

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
    $type = !empty($data['type']) ? $data['type'] : 'lesson';

    $stmt = $conn->prepare("UPDATE exam_presets SET preset_name = ?, lessons_data = ?, type = ? WHERE id = ?");
    $stmt->bind_param("sssi", $preset_name, $lessons_data, $type, $id);

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
