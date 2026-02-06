<?php
/**
 * Resolve Mistakes API
 * 
 * Marks questions as resolved in the Mistake Bank when answered correctly.
 */

require_once '../subject/db_connect.php';
header('Content-Type: application/json');

$data = json_decode(file_get_contents("php://input"), true);

if (empty($data['questions']) || !is_array($data['questions'])) {
    echo json_encode(['success' => false, 'message' => 'No correct questions provided.']);
    exit;
}

$success_count = 0;
$errors = [];

foreach ($data['questions'] as $q_id) {
    if (empty($q_id)) continue;

    $q_id = intval($q_id);

    // Update the question to resolved = 1 in the mistake bank
    // We only update if it already exists in the bank
    $stmt = $conn->prepare("UPDATE mistake_bank SET resolved = 1 WHERE question_id = ?");
    $stmt->bind_param("i", $q_id);

    if ($stmt->execute()) {
        if ($stmt->affected_rows > 0) {
            $success_count++;
        }
    } else {
        $errors[] = $conn->error;
    }
    $stmt->close();
}

echo json_encode([
    'success' => true,
    'message' => "Resolved $success_count persistent mistakes.",
    'errors' => $errors
]);

$conn->close();
?>
