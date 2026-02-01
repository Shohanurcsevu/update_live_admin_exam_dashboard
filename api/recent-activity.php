<?php
require_once 'subject/db_connect.php';
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *'); // Consider restricting this in production for security
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

date_default_timezone_set('Asia/Dhaka');

// --- NEW: Check if this is just a request for a new notification count ---
if (isset($_GET['check_since'])) {
    $last_id = intval($_GET['check_since']);
    $stmt = $conn->prepare("SELECT COUNT(*) as new_count FROM activity_log WHERE id > ?");
    $stmt->bind_param("i", $last_id);
    $stmt->execute();
    $result = $stmt->get_result()->fetch_assoc();
    
    header('Content-Type: application/json');
    echo json_encode(['success' => true, 'new_count' => $result['new_count']]);
    
    $stmt->close();
    $conn->close();
    exit; // Stop execution after sending the count
}

// --- Full fetch logic (for when the user clicks the bell) ---
function time_ago($datetime, $full = false) {
    $now = new DateTime;
    $ago = new DateTime($datetime);
    $diff = $now->diff($ago);

    $diff->w = floor($diff->d / 7);
    $diff->d -= $diff->w * 7;

    $string = array('y' => 'year', 'm' => 'month', 'w' => 'week', 'd' => 'day', 'h' => 'hour', 'i' => 'minute', 's' => 'second');
    foreach ($string as $k => &$v) {
        if ($diff->$k) {
            $v = $diff->$k . ' ' . $v . ($diff->$k > 1 ? 's' : '');
        } else {
            unset($string[$k]);
        }
    }

    if (!$full) $string = array_slice($string, 0, 1);
    return $string ? implode(', ', $string) . ' ago' : 'just now';
}

$sql = "SELECT id, activity_type, activity_message, timestamp FROM activity_log ORDER BY id DESC LIMIT 10";
$result = $conn->query($sql);
$activities = [];

if ($result) {
    while ($row = $result->fetch_assoc()) {
        $row['time_ago'] = time_ago($row['timestamp']);
        $activities[] = $row;
    }
}

header('Content-Type: application/json');
echo json_encode(['success' => true, 'data' => $activities]);
$conn->close();
?>
