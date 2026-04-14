<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *'); 
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/../subject/db_connect.php';

// Get the action from the request
$action = isset($_GET['action']) ? $_GET['action'] : 'list';

function log_activity($conn, $type, $message) {
    $stmt = $conn->prepare("INSERT INTO activity_log (activity_type, activity_message) VALUES (?, ?)");
    $stmt->bind_param("ss", $type, $message);
    $stmt->execute();
    $stmt->close();
}

switch ($action) {
    case 'list':
        list_posts($conn);
        break;
    case 'get_authors':
        get_authors($conn);
        break;
    case 'create':
        create_post($conn);
        break;
    case 'update':
        update_post($conn);
        break;
    case 'delete':
        delete_post($conn);
        break;
    default:
        echo json_encode(['success' => false, 'message' => 'Invalid action.']);
        break;
}

function list_posts($conn) {
    $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 10;
    $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;
    $author = isset($_GET['author']) ? $_GET['author'] : '';

    $whereClause = "WHERE is_deleted = 0";
    $params = [];
    $types = "";

    if (!empty($author)) {
        $whereClause .= " AND author_name = ?";
        $params[] = $author;
        $types .= "s";
    }

    $query = "SELECT * FROM fb_posts $whereClause ORDER BY created_at DESC LIMIT ? OFFSET ?";
    $params[] = $limit;
    $params[] = $offset;
    $types .= "ii";

    $stmt = $conn->prepare($query);
    if (!empty($types)) {
        $stmt->bind_param($types, ...$params);
    }
    $stmt->execute();
    $result = $stmt->get_result();

    $posts = [];
    while ($row = $result->fetch_assoc()) {
        $posts[] = $row;
    }

    // Check for more
    $hasMore = false;
    if (count($posts) == $limit) {
        $nextOffset = $offset + $limit;
        $checkQuery = "SELECT id FROM fb_posts $whereClause LIMIT 1 OFFSET ?";
        $checkStmt = $conn->prepare($checkQuery);
        
        $checkParams = [];
        $checkTypes = "";
        if (!empty($author)) {
            $checkParams[] = $author;
            $checkTypes .= "s";
        }
        $checkParams[] = $nextOffset;
        $checkTypes .= "i";
        
        $checkStmt->bind_param($checkTypes, ...$checkParams);
        $checkStmt->execute();
        if ($checkStmt->get_result()->num_rows > 0) {
            $hasMore = true;
        }
    }

    echo json_encode(["success" => true, "data" => $posts, "has_more" => $hasMore]);
}

function get_authors($conn) {
    $query = "SELECT DISTINCT author_name FROM fb_posts WHERE author_name != '' AND is_deleted = 0 ORDER BY author_name ASC";
    $result = $conn->query($query);
    $authors = [];
    while ($row = $result->fetch_assoc()) {
        $authors[] = $row['author_name'];
    }
    echo json_encode(["success" => true, "data" => $authors]);
}

function create_post($conn) {
    $data = json_decode(file_get_contents('php://input'), true);
    if (!$data) {
        echo json_encode(['success' => false, 'message' => 'Invalid data provided.']);
        return;
    }

    $stmt = $conn->prepare("INSERT INTO fb_posts (author_name, post_body, source_url, telegram_sent, created_at) VALUES (?, ?, ?, ?, NOW())");
    $telegram_sent = isset($data['telegram_sent']) ? (int)$data['telegram_sent'] : 0;
    $stmt->bind_param("sssi", $data['author_name'], $data['post_body'], $data['source_url'], $telegram_sent);

    if ($stmt->execute()) {
        log_activity($conn, 'FB Post Created', "Created post by '" . $data['author_name'] . "'");
        echo json_encode(['success' => true, 'message' => 'Post created successfully.', 'id' => $conn->insert_id]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Error: ' . $stmt->error]);
    }
    $stmt->close();
}

function update_post($conn) {
    $data = json_decode(file_get_contents('php://input'), true);
    if (!isset($data['id'])) {
        echo json_encode(['success' => false, 'message' => 'Post ID not provided.']);
        return;
    }

    $id = (int)$data['id'];
    $stmt = $conn->prepare("UPDATE fb_posts SET author_name = ?, post_body = ?, source_url = ?, telegram_sent = ? WHERE id = ?");
    $telegram_sent = isset($data['telegram_sent']) ? (int)$data['telegram_sent'] : 0;
    $stmt->bind_param("sssii", $data['author_name'], $data['post_body'], $data['source_url'], $telegram_sent, $id);

    if ($stmt->execute()) {
        log_activity($conn, 'FB Post Updated', "Updated post ID: $id");
        echo json_encode(['success' => true, 'message' => 'Post updated successfully.']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Error: ' . $stmt->error]);
    }
    $stmt->close();
}

function delete_post($conn) {
    $data = json_decode(file_get_contents('php://input'), true);
    if (!isset($data['id'])) {
        echo json_encode(['success' => false, 'message' => 'Post ID not provided.']);
        return;
    }

    $id = (int)$data['id'];
    $stmt = $conn->prepare("UPDATE fb_posts SET is_deleted = 1 WHERE id = ?");
    $stmt->bind_param("i", $id);

    if ($stmt->execute()) {
        log_activity($conn, 'FB Post Deleted', "Soft-deleted post ID: $id");
        echo json_encode(['success' => true, 'message' => 'Post deleted successfully.']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Error: ' . $stmt->error]);
    }
    $stmt->close();
}

$conn->close();
?>
