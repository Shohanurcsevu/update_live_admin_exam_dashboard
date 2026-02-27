<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../subject/db_connect.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $result = $conn->query("SELECT job_name, deadline FROM job_countdown LIMIT 1");
    if ($result && $row = $result->fetch_assoc()) {
        echo json_encode(['success' => true, 'data' => $row]);
    } else {
        echo json_encode(['success' => false, 'message' => 'No data found']);
    }
} elseif ($method === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($data['job_name']) || !isset($data['deadline'])) {
        echo json_encode(['success' => false, 'message' => 'Missing required fields']);
        exit;
    }

    $job_name = $conn->real_escape_string($data['job_name']);
    $deadline = $conn->real_escape_string($data['deadline']);

    // Check if record exists
    $check = $conn->query("SELECT id FROM job_countdown LIMIT 1");
    if ($check && $row = $check->fetch_assoc()) {
        $id = $row['id'];
        $sql = "UPDATE job_countdown SET job_name = '$job_name', deadline = '$deadline' WHERE id = $id";
    } else {
        $sql = "INSERT INTO job_countdown (job_name, deadline) VALUES ('$job_name', '$deadline')";
    }

    if ($conn->query($sql) === TRUE) {
        echo json_encode(['success' => true, 'message' => 'Countdown updated successfully']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Error: ' . $conn->error]);
    }
}

$conn->close();
?>
