<?php
require_once '../subject/db_connect.php';

$action = isset($_GET['action']) ? $_GET['action'] : 'list';

switch ($action) {
    case 'list':
        list_topics($conn);
        break;
    case 'create':
        create_topic($conn);
        break;
    case 'get_single':
        get_topic($conn);
        break;
    case 'update':
        update_topic($conn);
        break;
    case 'delete':
        delete_topic($conn);
        break;
    default:
        echo json_encode(['success' => false, 'message' => 'Invalid action for topics.']);
        break;
}

// Helper function to add to the activity log
function log_activity($conn, $type, $message) {
    $stmt = $conn->prepare("INSERT INTO activity_log (activity_type, activity_message) VALUES (?, ?)");
    $stmt->bind_param("ss", $type, $message);
    $stmt->execute();
    $stmt->close();
}

function list_topics($conn) {
    $subject_id = isset($_GET['subject_id']) ? intval($_GET['subject_id']) : 0;
    $lesson_id = isset($_GET['lesson_id']) ? intval($_GET['lesson_id']) : 0;

    // --- MODIFIED: Added LEFT JOIN and COUNT to get created_exams ---
    $sql = "SELECT t.*, s.subject_name, l.lesson_name, COUNT(e.id) as created_exams
            FROM topics t 
            JOIN subjects s ON t.subject_id = s.id 
            JOIN lessons l ON t.lesson_id = l.id
            LEFT JOIN exams e ON t.id = e.topic_id";
    
    $params = [];
    $types = '';
    $where_clauses = [];

    if ($subject_id > 0) {
        $where_clauses[] = "t.subject_id = ?";
        $params[] = $subject_id;
        $types .= 'i';
    }
    if ($lesson_id > 0) {
        $where_clauses[] = "t.lesson_id = ?";
        $params[] = $lesson_id;
        $types .= 'i';
    }

    if (!empty($where_clauses)) {
        $sql .= " WHERE " . implode(' AND ', $where_clauses);
    }
    
    // --- MODIFIED: Added GROUP BY ---
    $sql .= " GROUP BY t.id ORDER BY t.id ASC";
    
    $stmt = $conn->prepare($sql);
    if (!empty($params)) {
        $stmt->bind_param($types, ...$params);
    }
    
    $stmt->execute();
    $result = $stmt->get_result();
    $topics = [];
    while ($row = $result->fetch_assoc()) {
        $topics[] = $row;
    }
    
    echo json_encode(['success' => true, 'data' => $topics]);
    $stmt->close();
}

function get_topic($conn) {
    $id = isset($_GET['id']) ? intval($_GET['id']) : 0;
    $stmt = $conn->prepare("SELECT * FROM topics WHERE id = ?");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $result = $stmt->get_result();
    $topic = $result->fetch_assoc();
    echo json_encode(['success' => true, 'data' => $topic]);
    $stmt->close();
}

function create_topic($conn) {
    $data = json_decode(file_get_contents('php://input'), true);
    $stmt = $conn->prepare("INSERT INTO topics (subject_id, lesson_id, topic_name, start_page, end_page, expected_exams) VALUES (?, ?, ?, ?, ?, ?)");
    $stmt->bind_param("iisiii", $data['subject_id'], $data['lesson_id'], $data['topic_name'], $data['start_page'], $data['end_page'], $data['expected_exams']);
    if ($stmt->execute()) {
         $message = "Topic '" . $data['topic_name'] . "' has been created.";
        log_activity($conn, 'Topic Created', $message);
        echo json_encode(['success' => true, 'message' => 'Topic created successfully.']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Failed to create topic.']);
    }
    $stmt->close();
}

// function update_topic($conn) {
//     $data = json_decode(file_get_contents('php://input'), true);
//     $stmt = $conn->prepare("UPDATE topics SET subject_id = ?, lesson_id = ?, topic_name = ?, start_page = ?, end_page = ?, expected_exams = ? WHERE id = ?");
//     $stmt->bind_param("iisiiii", $data['subject_id'], $data['lesson_id'], $data['topic_name'], $data['start_page'], $data['end_page'], $data['expected_exams'], $data['id']);
//     if ($stmt->execute()) {
//             // --- NEW: Log this activity ---
//        $message = "Topic '" . $data['topic_name'] . "' has been updated successfully.";
//         log_activity($conn, 'Topic Updated', $message);
//         echo json_encode(['success' => true, 'message' => 'Topic updated successfully.']);
//     } else {
//         echo json_encode(['success' => false, 'message' => 'Failed to update topic.']);
//     }
//     $stmt->close();
// }
function update_topic($conn) {
    $data = json_decode(file_get_contents('php://input'), true);

    // ✅ Step 1: Fetch original topic data
    $stmt_select = $conn->prepare("SELECT * FROM topics WHERE id = ?");
    $stmt_select->bind_param("i", $data['id']);
    $stmt_select->execute();
    $result = $stmt_select->get_result();

    if ($result->num_rows === 0) {
        echo json_encode(['success' => false, 'message' => 'Topic not found.']);
        return;
    }

    $original = $result->fetch_assoc();
    $stmt_select->close();

    // ✅ Step 2: Perform the update
    $stmt = $conn->prepare("UPDATE topics SET subject_id = ?, lesson_id = ?, topic_name = ?, start_page = ?, end_page = ?, expected_exams = ? WHERE id = ?");
    $stmt->bind_param(
        "iisiiii",
        $data['subject_id'],
        $data['lesson_id'],
        $data['topic_name'],
        $data['start_page'],
        $data['end_page'],
        $data['expected_exams'],
        $data['id']
    );

    if ($stmt->execute()) {
        // ✅ Step 3: Compare fields and build change message
        $changes = [];

        if ($data['topic_name'] !== $original['topic_name']) {
            $changes[] = "Name: '" . $original['topic_name'] . "' → '" . $data['topic_name'] . "'";
        }
        if ($data['subject_id'] != $original['subject_id']) {
            $changes[] = "Subject ID: " . $original['subject_id'] . " → " . $data['subject_id'];
        }
        if ($data['lesson_id'] != $original['lesson_id']) {
            $changes[] = "Lesson ID: " . $original['lesson_id'] . " → " . $data['lesson_id'];
        }
        if ($data['start_page'] != $original['start_page']) {
            $changes[] = "Start Page: " . $original['start_page'] . " → " . $data['start_page'];
        }
        if ($data['end_page'] != $original['end_page']) {
            $changes[] = "End Page: " . $original['end_page'] . " → " . $data['end_page'];
        }
        if ($data['expected_exams'] != $original['expected_exams']) {
            $changes[] = "Expected Exams: " . $original['expected_exams'] . " → " . $data['expected_exams'];
        }

        // ✅ Step 4: Log if any changes occurred
        if (!empty($changes)) {
            $message = "Topic '" . $original['topic_name'] . "' (ID: " . $original['id'] . ") updated. Changes: " . implode("; ", $changes) . ".";
            log_activity($conn, 'Topic Updated', $message);
        }

        echo json_encode(['success' => true, 'message' => 'Topic updated successfully.']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Failed to update topic.']);
    }

    $stmt->close();
}


// function delete_topic($conn) {
//     $data = json_decode(file_get_contents('php://input'), true);
//     $id = intval($data['id']);
//     $stmt = $conn->prepare("DELETE FROM topics WHERE id = ?");
//     $stmt->bind_param("i", $id);
//     if ($stmt->execute()) {
//         echo json_encode(['success' => true, 'message' => 'Topic deleted successfully.']);
//     } else {
//         echo json_encode(['success' => false, 'message' => 'Failed to delete topic.']);
//     }
//     $stmt->close();
// }

function delete_topic($conn) {
    $data = json_decode(file_get_contents('php://input'), true);

    if (!isset($data['id'])) {
        echo json_encode(['success' => false, 'message' => 'Topic ID not provided.']);
        return;
    }

    $id = intval($data['id']);

    // ✅ Step 1: Fetch topic name before deleting
    $stmt_select = $conn->prepare("SELECT topic_name FROM topics WHERE id = ?");
    $stmt_select->bind_param("i", $id);
    $stmt_select->execute();
    $result = $stmt_select->get_result();

    if ($result->num_rows === 0) {
        echo json_encode(['success' => false, 'message' => 'Topic not found.']);
        $stmt_select->close();
        return;
    }

    $row = $result->fetch_assoc();
    $topic_name = $row['topic_name'];
    $stmt_select->close();

    // ✅ Step 2: Proceed to delete
    $stmt = $conn->prepare("DELETE FROM topics WHERE id = ?");
    $stmt->bind_param("i", $id);

    if ($stmt->execute()) {
        if ($stmt->affected_rows > 0) {
            // ✅ Log activity with accurate topic name
            $message = "Topic '" . $topic_name . "' (ID: " . $id . ") has been deleted.";
            log_activity($conn, 'Topic Deleted', $message);
            echo json_encode(['success' => true, 'message' => 'Topic deleted successfully.']);
        } else {
            echo json_encode(['success' => false, 'message' => 'Topic not found or already deleted.']);
        }
    } else {
        echo json_encode(['success' => false, 'message' => 'Error: ' . $stmt->error]);
    }

    $stmt->close();
}


$conn->close();
?>
