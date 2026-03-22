<?php
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once '../subject/db_connect.php';

// Auto-create table if not exists
$conn->query("CREATE TABLE IF NOT EXISTS `ai_prompt_presets` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `prompt_text` LONGTEXT NOT NULL,
  `is_default` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

$action = $_GET['action'] ?? 'list';

switch ($action) {
    case 'list':   list_presets($conn); break;
    case 'get':    get_preset($conn);   break;
    case 'create': create_preset($conn); break;
    case 'update': update_preset($conn); break;
    case 'delete': delete_preset($conn); break;
    default:
        echo json_encode(['success' => false, 'message' => 'Invalid action.']);
}

// ─── LIST ────────────────────────────────────────────────
function list_presets($conn) {
    $result = $conn->query("SELECT id, name, is_default, updated_at FROM ai_prompt_presets ORDER BY is_default DESC, name ASC");
    $presets = [];
    while ($row = $result->fetch_assoc()) {
        $presets[] = $row;
    }
    echo json_encode(['success' => true, 'presets' => $presets]);
}

// ─── GET (single, full text) ─────────────────────────────
function get_preset($conn) {
    $id = intval($_GET['id'] ?? 0);
    if ($id <= 0) {
        echo json_encode(['success' => false, 'message' => 'Missing preset id.']);
        return;
    }
    $stmt = $conn->prepare("SELECT * FROM ai_prompt_presets WHERE id = ?");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $result = $stmt->get_result();
    $preset = $result->fetch_assoc();
    $stmt->close();

    if (!$preset) {
        echo json_encode(['success' => false, 'message' => 'Preset not found.']);
        return;
    }
    echo json_encode(['success' => true, 'preset' => $preset]);
}

// ─── CREATE ──────────────────────────────────────────────
function create_preset($conn) {
    $data = json_decode(file_get_contents('php://input'), true);
    $name = trim($data['name'] ?? '');
    $prompt_text = trim($data['prompt_text'] ?? '');

    if (empty($name) || empty($prompt_text)) {
        echo json_encode(['success' => false, 'message' => 'Name and prompt text are required.']);
        return;
    }

    $stmt = $conn->prepare("INSERT INTO ai_prompt_presets (name, prompt_text) VALUES (?, ?)");
    $stmt->bind_param("ss", $name, $prompt_text);

    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'id' => $conn->insert_id, 'message' => 'Preset created.']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Failed to create preset: ' . $conn->error]);
    }
    $stmt->close();
}

// ─── UPDATE ──────────────────────────────────────────────
function update_preset($conn) {
    $data = json_decode(file_get_contents('php://input'), true);
    $id = intval($data['id'] ?? 0);
    $name = trim($data['name'] ?? '');
    $prompt_text = trim($data['prompt_text'] ?? '');

    if ($id <= 0 || empty($name) || empty($prompt_text)) {
        echo json_encode(['success' => false, 'message' => 'ID, name, and prompt text are required.']);
        return;
    }

    $stmt = $conn->prepare("UPDATE ai_prompt_presets SET name = ?, prompt_text = ? WHERE id = ?");
    $stmt->bind_param("ssi", $name, $prompt_text, $id);

    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'message' => 'Preset updated.']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Failed to update preset: ' . $conn->error]);
    }
    $stmt->close();
}

// ─── DELETE ──────────────────────────────────────────────
function delete_preset($conn) {
    $data = json_decode(file_get_contents('php://input'), true);
    $id = intval($data['id'] ?? 0);

    if ($id <= 0) {
        echo json_encode(['success' => false, 'message' => 'Missing preset id.']);
        return;
    }

    // Block deletion of default presets
    $check = $conn->prepare("SELECT is_default FROM ai_prompt_presets WHERE id = ?");
    $check->bind_param("i", $id);
    $check->execute();
    $row = $check->get_result()->fetch_assoc();
    $check->close();

    if (!$row) {
        echo json_encode(['success' => false, 'message' => 'Preset not found.']);
        return;
    }
    if ($row['is_default'] == 1) {
        echo json_encode(['success' => false, 'message' => 'Cannot delete a default preset.']);
        return;
    }

    $stmt = $conn->prepare("DELETE FROM ai_prompt_presets WHERE id = ?");
    $stmt->bind_param("i", $id);

    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'message' => 'Preset deleted.']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Failed to delete preset: ' . $conn->error]);
    }
    $stmt->close();
}
