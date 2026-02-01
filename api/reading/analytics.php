<?php
require_once '../subject/db_connect.php';

if (empty($_GET['subject_id'])) {
    echo json_encode(['success' => false, 'message' => 'Subject ID is required.']);
    exit;
}

$subject_id = intval($_GET['subject_id']);

// 1. Fetch Subject Details
$subject_stmt = $conn->prepare("SELECT * FROM subjects WHERE id = ?");
$subject_stmt->bind_param("i", $subject_id);
$subject_stmt->execute();
$subject_result = $subject_stmt->get_result();
if ($subject_result->num_rows === 0) {
    echo json_encode(['success' => false, 'message' => 'Subject not found.']);
    exit;
}
$subject = $subject_result->fetch_assoc();
$subject_stmt->close();

// 2. Fetch All Reading Logs for the Subject
$logs_stmt = $conn->prepare("SELECT read_date, pages_read FROM reading_logs WHERE subject_id = ?");
$logs_stmt->bind_param("i", $subject_id);
$logs_stmt->execute();
$logs_result = $logs_stmt->get_result();
$reading_logs = [];
$total_pages_read = 0;
while ($row = $logs_result->fetch_assoc()) {
    $reading_logs[$row['read_date']] = $row['pages_read'];
    $total_pages_read += $row['pages_read'];
}
$logs_stmt->close();

// 3. Perform Calculations
$today = new DateTime();
$today->setTime(0, 0, 0);
$start_date = new DateTime($subject['start_date']);
$end_date = new DateTime($subject['end_date']);
$total_pages = intval($subject['total_pages']);

// Date metrics
$total_days = max(1, $start_date->diff($end_date)->days + 1);
$days_past = 0;
if ($today >= $start_date) {
    $days_past = $start_date->diff($today)->days;
    if ($today > $end_date) {
        $days_past = $total_days;
    }
}
$days_left = max(0, $total_days - $days_past);

// Page and pace metrics
$pages_left = max(0, $total_pages - $total_pages_read);
$ideal_pace = $total_days > 0 ? ($total_pages / $total_days) : 0;
$ideal_pages_by_today = $ideal_pace * $days_past;
$average_reading = $days_past > 0 ? ($total_pages_read / $days_past) : 0;
$read_page_today = isset($reading_logs[$today->format('Y-m-d')]) ? $reading_logs[$today->format('Y-m-d')] : 0;
$required_pace_from_now = $days_left > 0 ? ($pages_left / $days_left) : 0;
$left_to_read_today = max(0, $required_pace_from_now - $read_page_today);

// Percentage metrics
$progress_percent = $total_pages > 0 ? ($total_pages_read / $total_pages) * 100 : 0;
$required_reading_percent = $total_pages > 0 ? ($ideal_pages_by_today / $total_pages) * 100 : 0;
$reading_behind_pages = max(0, $ideal_pages_by_today - $total_pages_read);


$analytics = [
    'subject_details' => $subject,
    'reading_logs' => $reading_logs,
    'calculations' => [
        'totalPages' => $total_pages,
        'totalPagesRead' => $total_pages_read,
        'totalPagesLeft' => $pages_left,
        'needToReadPagePerDay' => round($required_pace_from_now, 2),
        'readPageToday' => $read_page_today,
        'leftToReadToday' => round($left_to_read_today, 2),
        'pageProgressPercent' => round($progress_percent, 2),
        'averageReading' => round($average_reading, 2),
        'requiredReadingPace' => round($ideal_pace, 2),
        'readingBehindPages' => round($reading_behind_pages),
        'totalDays' => $total_days,
        'daysPast' => $days_past,
        'daysLeft' => $days_left,
    ]
];

echo json_encode(['success' => true, 'data' => $analytics]);

$conn->close();
?>
