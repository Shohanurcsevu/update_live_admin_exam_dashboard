<?php
require_once '../subject/db_connect.php';
header('Content-Type: application/json');

/**
 * SRS Revision Stats API
 * Counts questions currently due for review.
 */

$response = [
    'success' => true,
    'due_count' => 0,
    'total_tracked' => 0
];

try {
    // Count questions where next_review_at <= NOW
    // We group by question content implicitly by assuming question_id is unique enough,
    // but in create-from-performance we aggregate by text. 
    // Here we just count the entries in question_srs that are due.
    
    $sql = "SELECT 
                COUNT(*) as count,
                SUM(CASE WHEN next_review_at <= CURRENT_TIMESTAMP THEN 1 ELSE 0 END) as due
            FROM question_srs";

    $result = $conn->query($sql);
    if ($result && $row = $result->fetch_assoc()) {
        $response['due_count'] = intval($row['due']);
        $response['total_tracked'] = intval($row['count']);
    }


} catch (Exception $e) {
    $response['success'] = false;
    $response['message'] = $e->getMessage();
}

echo json_encode($response);
$conn->close();
?>
