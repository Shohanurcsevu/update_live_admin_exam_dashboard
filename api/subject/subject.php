<?php
// header('Content-Type: application/json');
// header('Access-Control-Allow-Origin: *'); // Consider restricting this in production for security
// header('Access-Control-Allow-Methods: POST, OPTIONS');
// header('Access-Control-Allow-Headers: Content-Type, Authorization');
// require_once 'db_connect.php';

// CORS headers
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *'); 
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Stop execution if it's a preflight request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once 'db_connect.php';


// Get the action from the request, default to 'list'
$action = isset($_GET['action']) ? $_GET['action'] : 'list';

switch ($action) {
    case 'list':
        list_subjects($conn);
        break;
    case 'get_single':
        get_subject($conn);
        break;
    case 'create':
        create_subject($conn);
        break;
    case 'update':
        update_subject($conn);
        break;
    case 'delete':
        delete_subject($conn);
        break;
    default:
        echo json_encode(['success' => false, 'message' => 'Invalid action.']);
        break;
}
// Helper function to add to the activity log
function log_activity($conn, $type, $message) {
    $stmt = $conn->prepare("INSERT INTO activity_log (activity_type, activity_message) VALUES (?, ?)");
    $stmt->bind_param("ss", $type, $message);
    $stmt->execute();
    $stmt->close();
}

// Function to get all subjects with a count of their lessons
function list_subjects($conn) {
    // --- MODIFIED: Added LEFT JOIN and COUNT to get created_lessons ---
    $sql = "SELECT s.*, COUNT(l.id) AS created_lessons
            FROM subjects s
            LEFT JOIN lessons l ON s.id = l.subject_id AND l.is_deleted = 0
            WHERE s.is_deleted = 0
            GROUP BY s.id
            ORDER BY s.id ASC";
    
    $result = $conn->query($sql);
    $subjects = [];
    if ($result->num_rows > 0) {
        while($row = $result->fetch_assoc()) {
            $subjects[] = $row;
        }
    }
    echo json_encode(['success' => true, 'data' => $subjects]);
}

// Function to get a single subject by ID
function get_subject($conn) {
    if (!isset($_GET['id'])) {
        echo json_encode(['success' => false, 'message' => 'Subject ID not provided.']);
        return;
    }
    $id = intval($_GET['id']);
    $stmt = $conn->prepare("SELECT * FROM subjects WHERE id = ? AND is_deleted = 0");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $result = $stmt->get_result();
    if ($result->num_rows > 0) {
        echo json_encode(['success' => true, 'data' => $result->fetch_assoc()]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Subject not found.']);
    }
    $stmt->close();
}


// Function to create a new subject
function create_subject($conn) {
    $data = json_decode(file_get_contents('php://input'), true);
    
    $stmt = $conn->prepare("INSERT INTO subjects (subject_name, book_name, total_lessons, total_pages, start_date, end_date, category) VALUES (?, ?, ?, ?, ?, ?, ?)");
    $stmt->bind_param("ssiisss", $data['subject_name'], $data['book_name'], $data['total_lessons'], $data['total_pages'], $data['start_date'], $data['end_date'], $data['category']);
    
    if ($stmt->execute()) {
         // --- NEW: Log this activity ---
        $message = "A new subject was created: '" . $data['subject_name'] . "'";
        log_activity($conn, 'Subject Created', $message);
        echo json_encode(['success' => true, 'message' => 'Subject created successfully.']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Error: ' . $stmt->error]);
    }
    $stmt->close();
}

// Function to update an existing subject
// function update_subject($conn) {
//     $data = json_decode(file_get_contents('php://input'), true);
    
//     $stmt = $conn->prepare("UPDATE subjects SET subject_name = ?, book_name = ?, total_lessons = ?, total_pages = ?, start_date = ?, end_date = ?, category = ? WHERE id = ?");
//     $stmt->bind_param("ssiisssi", $data['subject_name'], $data['book_name'], $data['total_lessons'], $data['total_pages'], $data['start_date'], $data['end_date'], $data['category'], $data['id']);
    
//     if ($stmt->execute()) {
//         // --- NEW: Log this activity ---
//         $message = "'" . $data['subject_name'] . "' has been updated successfully.";
//         log_activity($conn, 'Subject Updated', $message);
//         echo json_encode(['success' => true, 'message' => 'Subject updated successfully.']);
//     } else {
//         echo json_encode(['success' => false, 'message' => 'Error: ' . $stmt->error]);
//     }
//     $stmt->close();
// }

function update_subject($conn) {
    $data = json_decode(file_get_contents('php://input'), true);

    // ✅ Step 1: Fetch original subject data
    $stmt_select = $conn->prepare("SELECT * FROM subjects WHERE id = ?");
    $stmt_select->bind_param("i", $data['id']);
    $stmt_select->execute();
    $result = $stmt_select->get_result();

    if ($result->num_rows === 0) {
        echo json_encode(['success' => false, 'message' => 'Subject not found.']);
        return;
    }

    $original = $result->fetch_assoc();
    $stmt_select->close();

    // ✅ Step 2: Perform the update
    $stmt = $conn->prepare("UPDATE subjects SET subject_name = ?, book_name = ?, total_lessons = ?, total_pages = ?, start_date = ?, end_date = ?, category = ? WHERE id = ?");
    $stmt->bind_param(
        "ssiisssi",
        $data['subject_name'],
        $data['book_name'],
        $data['total_lessons'],
        $data['total_pages'],
        $data['start_date'],
        $data['end_date'],
        $data['category'],
        $data['id']
    );

    if ($stmt->execute()) {
        // ✅ Step 3: Compare fields and prepare log message
        $changes = [];

        if ($data['subject_name'] !== $original['subject_name']) {
            $changes[] = "Name: '" . $original['subject_name'] . "' → '" . $data['subject_name'] . "'";
        }
        if ($data['book_name'] !== $original['book_name']) {
            $changes[] = "Book: '" . $original['book_name'] . "' → '" . $data['book_name'] . "'";
        }
        if ($data['total_lessons'] != $original['total_lessons']) {
            $changes[] = "Lessons: " . $original['total_lessons'] . " → " . $data['total_lessons'];
        }
        if ($data['total_pages'] != $original['total_pages']) {
            $changes[] = "Pages: " . $original['total_pages'] . " → " . $data['total_pages'];
        }
        if ($data['start_date'] !== $original['start_date']) {
            $changes[] = "Start Date: " . $original['start_date'] . " → " . $data['start_date'];
        }
        if ($data['end_date'] !== $original['end_date']) {
            $changes[] = "End Date: " . $original['end_date'] . " → " . $data['end_date'];
        }
        if ($data['category'] !== $original['category']) {
            $changes[] = "Category: '" . $original['category'] . "' → '" . $data['category'] . "'";
        }

        if (!empty($changes)) {
            $message = "Subject '" . $original['subject_name'] . "' (ID: " . $original['id'] . ") updated. Changes: " . implode("; ", $changes) . ".";
            log_activity($conn, 'Subject Updated', $message);
        }

        echo json_encode(['success' => true, 'message' => 'Subject updated successfully.']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Error: ' . $stmt->error]);
    }

    $stmt->close();
}


// Function to delete a subject
// function delete_subject($conn) {
//     $data = json_decode(file_get_contents('php://input'), true);

//     if (!isset($data['id'])) {
//         echo json_encode(['success' => false, 'message' => 'Subject ID not provided.']);
//         return;
//     }

//     $id = intval($data['id']);
//     $stmt = $conn->prepare("DELETE FROM subjects WHERE id = ?");
//     $stmt->bind_param("i", $id);
    
//     if ($stmt->execute()) {
//         if ($stmt->affected_rows > 0) {
//                          // --- NEW: Log this activity ---
//             $message = "Subject '" . $data['subject_name'] . "' (ID: " . $data['id'] . ") has been deleted successfully.";
//             log_activity($conn, 'Subject Deleted', $message);
//             echo json_encode(['success' => true, 'message' => 'Subject deleted successfully.']);
//         } else {
//             echo json_encode(['success' => false, 'message' => 'Subject not found or already deleted.']);
//         }
//     } else {
//         echo json_encode(['success' => false, 'message' => 'Error: ' . $stmt->error]);
//     }
//     $stmt->close();
// }

// Function to delete a subject
function delete_subject($conn) {
    $data = json_decode(file_get_contents('php://input'), true);

    if (!isset($data['id'])) {
        echo json_encode(['success' => false, 'message' => 'Subject ID not provided.']);
        return;
    }

    $id = intval($data['id']);

    // ✅ Step 1: Fetch subject name before deleting
    $stmt_select = $conn->prepare("SELECT subject_name FROM subjects WHERE id = ?");
    $stmt_select->bind_param("i", $id);
    $stmt_select->execute();
    $result = $stmt_select->get_result();

    if ($result->num_rows === 0) {
        echo json_encode(['success' => false, 'message' => 'Subject not found.']);
        return;
    }

    $row = $result->fetch_assoc();
    $subject_name = $row['subject_name'];
    $stmt_select->close();

    // ✅ Step 2: Proceed to soft delete
    $stmt = $conn->prepare("UPDATE subjects SET is_deleted = 1 WHERE id = ?");
    $stmt->bind_param("i", $id);

    if ($stmt->execute()) {
        if ($stmt->affected_rows > 0) {
            // ✅ Log activity with accurate subject name
            $message = "Subject '" . $subject_name . "' (ID: " . $id . ") has been soft-deleted successfully.";
            log_activity($conn, 'Subject Deleted', $message);
            echo json_encode(['success' => true, 'message' => 'Subject deleted successfully.']);
        } else {
            echo json_encode(['success' => false, 'message' => 'Subject not found or already deleted.']);
        }
    } else {
        echo json_encode(['success' => false, 'message' => 'Error: ' . $stmt->error]);
    }

    $stmt->close();
}


$conn->close();
?>
