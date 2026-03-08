<?php
require_once '../subject/db_connect.php';

/**
 * Bulk delete questions (soft delete).
 * Updates multiple questions and adjusts exam stats in a single transaction.
 */

$data = json_decode(file_get_contents("php://input"), true);

if (empty($data['ids']) || !is_array($data['ids'])) {
    echo json_encode(['success' => false, 'message' => 'An array of Question IDs is required.']);
    exit;
}

$ids = array_map('intval', $data['ids']);
$ids_str = implode(',', $ids);

if (empty($ids)) {
    echo json_encode(['success' => false, 'message' => 'No valid IDs provided.']);
    exit;
}

// 1. Fetch info to verify exam_id and count valid deletions
$stmt_check = $conn->prepare("SELECT DISTINCT exam_id FROM questions WHERE id IN ($ids_str) AND is_deleted = 0");
$stmt_check->execute();
$exam_result = $stmt_check->get_result();

if ($exam_result->num_rows === 0) {
    echo json_encode(['success' => false, 'message' => 'No active questions found for the given IDs.']);
    exit;
}

// For safety, we expect questions to belong to one exam in this context
$exam_ids = [];
while ($row = $exam_result->fetch_assoc()) {
    $exam_ids[] = $row['exam_id'];
}
$stmt_check->close();

$conn->begin_transaction();

try {
    // 2. Count how many are actually being deleted (to update stats correctly)
    $stmt_count = $conn->prepare("SELECT COUNT(*) as count FROM questions WHERE id IN ($ids_str) AND is_deleted = 0");
    $stmt_count->execute();
    $count_res = $stmt_count->get_result()->fetch_assoc();
    $delete_count = intval($count_res['count']);
    $stmt_count->close();

    // 3. Update questions status
    $stmt_upd = $conn->prepare("UPDATE questions SET is_deleted = 1 WHERE id IN ($ids_str)");
    $stmt_upd->execute();
    $stmt_upd->close();

    // 4. Update Exam stats for each affected exam
    foreach ($exam_ids as $eid) {
        // Count how many questions were deleted for THIS specific exam
        $stmt_e_count = $conn->prepare("SELECT COUNT(*) as count FROM questions WHERE id IN ($ids_str) AND exam_id = ?");
        $stmt_e_count->bind_param("i", $eid);
        $stmt_e_count->execute();
        $e_count = $stmt_e_count->get_result()->fetch_assoc()['count'];
        $stmt_e_count->close();

        if ($e_count > 0) {
            $update_exam = $conn->prepare("UPDATE exams SET duration = GREATEST(0, duration - ?), total_marks = GREATEST(0, total_marks - ?) WHERE id = ?");
            $update_exam->bind_param("iii", $e_count, $e_count, $eid);
            $update_exam->execute();
            $update_exam->close();
        }
    }

    // 5. Log activity
    $msg = "Bulk deleted $delete_count questions from IDs: $ids_str";
    $stmt_log = $conn->prepare("INSERT INTO activity_log (activity_type, activity_message) VALUES (?, ?)");
    $type = 'Bulk Question Deletion';
    $stmt_log->bind_param("ss", $type, $msg);
    $stmt_log->execute();
    $stmt_log->close();

    $conn->commit();
    echo json_encode(['success' => true, 'message' => "Successfully bulk deleted $delete_count questions.", 'count' => $delete_count]);
} catch (Exception $e) {
    $conn->rollback();
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}

$conn->close();
?>
