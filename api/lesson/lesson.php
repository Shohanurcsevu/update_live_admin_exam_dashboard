<?php
require_once '../subject/db_connect.php';

$action = isset($_GET['action']) ? $_GET['action'] : 'list';

switch ($action) {
    case 'list':
        list_lessons($conn);
        break;
    case 'create':
        create_lesson($conn);
        break;
    case 'get_single':
        get_lesson($conn);
        break;
    case 'update':
        update_lesson($conn);
        break;
    case 'delete':
        delete_lesson($conn);
        break;
    default:
        echo json_encode(['success' => false, 'message' => 'Invalid action for lessons.']);
        break;
}

// Helper function to add to the activity log
function log_activity($conn, $type, $message) {
    $stmt = $conn->prepare("INSERT INTO activity_log (activity_type, activity_message) VALUES (?, ?)");
    $stmt->bind_param("ss", $type, $message);
    $stmt->execute();
    $stmt->close();
}

function list_lessons($conn) {
    $subject_id = isset($_GET['subject_id']) ? intval($_GET['subject_id']) : 0;

    // --- MODIFIED: Added LEFT JOIN and COUNT to get created_topics ---
    $sql = "SELECT l.*, s.subject_name, COUNT(t.id) as created_topics 
            FROM lessons l 
            JOIN subjects s ON l.subject_id = s.id
            LEFT JOIN topics t ON l.id = t.lesson_id";
    
    $params = [];
    $types = '';

    if ($subject_id > 0) {
        $sql .= " WHERE l.subject_id = ?";
        $params[] = $subject_id;
        $types .= 'i';
    }

    $sql .= " GROUP BY l.id ORDER BY l.id ASC";
    
    $stmt = $conn->prepare($sql);
    if (!empty($params)) {
        $stmt->bind_param($types, ...$params);
    }
    
    $stmt->execute();
    $result = $stmt->get_result();
    $lessons = [];
    while ($row = $result->fetch_assoc()) {
        $lessons[] = $row;
    }
    
    echo json_encode(['success' => true, 'data' => $lessons]);
    $stmt->close();
}

function get_lesson($conn) {
    $id = isset($_GET['id']) ? intval($_GET['id']) : 0;
    $stmt = $conn->prepare("SELECT * FROM lessons WHERE id = ?");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $result = $stmt->get_result();
    $lesson = $result->fetch_assoc();
    echo json_encode(['success' => true, 'data' => $lesson]);
    $stmt->close();
}

function create_lesson($conn) {
    $data = json_decode(file_get_contents('php://input'), true);
    $stmt = $conn->prepare("INSERT INTO lessons (subject_id, lesson_name, expected_topics, start_page, end_page, py_bcs_ques) VALUES (?, ?, ?, ?, ?, ?)");
    $stmt->bind_param("isiiii", $data['subject_id'], $data['lesson_name'], $data['expected_topics'], $data['start_page'], $data['end_page'], $data['py_bcs_ques']);
    if ($stmt->execute()) {
                // --- NEW: Log this activity ---
       $message = "Lesson '" . $data['lesson_name'] . "' was created successfully.";
        log_activity($conn, 'Lesson Created', $message);
        echo json_encode(['success' => true, 'message' => 'Lesson created successfully.']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Failed to create lesson.']);
    }
    $stmt->close();
}

// function update_lesson($conn) {
//     $data = json_decode(file_get_contents('php://input'), true);
//     $stmt = $conn->prepare("UPDATE lessons SET subject_id = ?, lesson_name = ?, expected_topics = ?, start_page = ?, end_page = ?, py_bcs_ques = ? WHERE id = ?");
//     $stmt->bind_param("isiiiii", $data['subject_id'], $data['lesson_name'], $data['expected_topics'], $data['start_page'], $data['end_page'], $data['py_bcs_ques'], $data['id']);
//     if ($stmt->execute()) {
//          $message = "Lesson '" . $data['lesson_name'] . "' was updated successfully.";
//         log_activity($conn, 'Lesson Updated', $message);
//         echo json_encode(['success' => true, 'message' => 'Lesson updated successfully.']);
//     } else {
//         echo json_encode(['success' => false, 'message' => 'Failed to update lesson.']);
//     }
//     $stmt->close();
// }
function update_lesson($conn) {
    $data = json_decode(file_get_contents('php://input'), true);

    // ✅ Step 1: Fetch original lesson data
    $stmt_select = $conn->prepare("SELECT * FROM lessons WHERE id = ?");
    $stmt_select->bind_param("i", $data['id']);
    $stmt_select->execute();
    $result = $stmt_select->get_result();

    if ($result->num_rows === 0) {
        echo json_encode(['success' => false, 'message' => 'Lesson not found.']);
        return;
    }

    $original = $result->fetch_assoc();
    $stmt_select->close();

    // ✅ Step 2: Perform the update
    $stmt = $conn->prepare("UPDATE lessons SET subject_id = ?, lesson_name = ?, expected_topics = ?, start_page = ?, end_page = ?, py_bcs_ques = ? WHERE id = ?");
    $stmt->bind_param(
        "isiiiii",
        $data['subject_id'],
        $data['lesson_name'],
        $data['expected_topics'],
        $data['start_page'],
        $data['end_page'],
        $data['py_bcs_ques'],
        $data['id']
    );

    if ($stmt->execute()) {
        // ✅ Step 3: Compare fields and prepare log message
        $changes = [];

        if ($data['lesson_name'] !== $original['lesson_name']) {
            $changes[] = "Name: '" . $original['lesson_name'] . "' → '" . $data['lesson_name'] . "'";
        }
        if ($data['subject_id'] != $original['subject_id']) {
            $changes[] = "Subject ID: " . $original['subject_id'] . " → " . $data['subject_id'];
        }
        if ($data['expected_topics'] != $original['expected_topics']) {
            $changes[] = "Expected Topics: " . $original['expected_topics'] . " → " . $data['expected_topics'];
        }
        if ($data['start_page'] != $original['start_page']) {
            $changes[] = "Start Page: " . $original['start_page'] . " → " . $data['start_page'];
        }
        if ($data['end_page'] != $original['end_page']) {
            $changes[] = "End Page: " . $original['end_page'] . " → " . $data['end_page'];
        }
        if ($data['py_bcs_ques'] != $original['py_bcs_ques']) {
            $changes[] = "Previous BCS Questions: " . $original['py_bcs_ques'] . " → " . $data['py_bcs_ques'];
        }

        if (!empty($changes)) {
            $message = "Lesson '" . $original['lesson_name'] . "' (ID: " . $original['id'] . ") updated. Changes: " . implode("; ", $changes) . ".";
            log_activity($conn, 'Lesson Updated', $message);
        }

        echo json_encode(['success' => true, 'message' => 'Lesson updated successfully.']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Failed to update lesson.']);
    }

    $stmt->close();
}


function delete_lesson($conn) {
    $data = json_decode(file_get_contents('php://input'), true);
    $id = intval($data['id']);
    // ✅ Step 1: Fetch lesson name before deleting
    $stmt_select = $conn->prepare("SELECT lesson_name FROM lessons WHERE id = ?");
    $stmt_select->bind_param("i", $id);
    $stmt_select->execute();
    $result = $stmt_select->get_result();

    if ($result->num_rows === 0) {
        echo json_encode(['success' => false, 'message' => 'Lesson not found.']);
        return;
    }

    $row = $result->fetch_assoc();
    $lesson_name = $row['lesson_name'];
    $stmt_select->close();
      // ✅ Step 2: Proceed to delete
    $stmt = $conn->prepare("DELETE FROM lessons WHERE id = ?");
    $stmt->bind_param("i", $id);


    if ($stmt->execute()) {
    if ($stmt->affected_rows > 0) {
        // ✅ Log activity with accurate lesson name
        $message = "Lesson '" . $lesson_name . "' (ID: " . $id . ") has been deleted successfully.";
        log_activity($conn, 'Lesson Deleted', $message);
        echo json_encode(['success' => true, 'message' => 'Lesson deleted successfully.']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Lesson not found or already deleted.']);
    }
} else {
    echo json_encode(['success' => false, 'message' => 'Error: ' . $stmt->error]);
}

    $stmt->close();
}

$conn->close();
?>
