<?php
header('Content-Type: application/json');
require_once '../subject/db_connect.php';

date_default_timezone_set('Asia/Dhaka');

try {
    $efficiency_data = [];

    // 1. Get all subjects
    $subjects_res = $conn->query("SELECT id, subject_name FROM subjects WHERE is_deleted = 0");
    while ($subject = $subjects_res->fetch_assoc()) {
        $subject_id = $subject['id'];
        $subject_name = $subject['subject_name'];

        // 2. Get study time (last 7 days)
        $time_sql = "
            SELECT SUM(seconds) as total_seconds
            FROM (
                -- Exams
                SELECT SUM(COALESCE(p.time_used_seconds, (SELECT COUNT(*) FROM questions q WHERE q.exam_id = p.exam_id) * 60)) as seconds
                FROM performance p
                JOIN exams e ON p.exam_id = e.id
                WHERE e.subject_id = $subject_id 
                AND p.attempt_time >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                
                UNION ALL
                
                -- Pomodoro
                SELECT SUM(CASE 
                    WHEN activity_details LIKE '%duration%'
                    THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(activity_details, '$.duration')) AS DECIMAL) * 60 
                    ELSE 25 * 60 
                END) as seconds
                FROM activity_log
                WHERE activity_type = 'pomodoro_session'
                AND activity_message = '$subject_name'
                AND timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            ) combined";
        
        $time_res = $conn->query($time_sql);
        $total_seconds = ($time_res && $row = $time_res->fetch_assoc()) ? (float)$row['total_seconds'] : 0;

        // 3. Get accuracy trend (Last 7 days vs previous 7 days)
        $accuracy_sql = "
            SELECT 
                AVG(CASE WHEN p.attempt_time >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN (p.score_with_negative / e.total_marks) * 100 END) as accuracy_this_week,
                AVG(CASE WHEN p.attempt_time >= DATE_SUB(NOW(), INTERVAL 14 DAY) AND p.attempt_time < DATE_SUB(NOW(), INTERVAL 7 DAY) THEN (p.score_with_negative / e.total_marks) * 100 END) as accuracy_last_week
            FROM performance p
            JOIN exams e ON p.exam_id = e.id
            WHERE e.subject_id = $subject_id";
        
        $acc_res = $conn->query($accuracy_sql);
        $acc_row = ($acc_res) ? $acc_res->fetch_assoc() : null;
        
        $this_week = $acc_row['accuracy_this_week'] !== null ? (float)$acc_row['accuracy_this_week'] : null;
        $last_week = $acc_row['accuracy_last_week'] !== null ? (float)$acc_row['accuracy_last_week'] : null;

        // 4. Categorize Efficiency
        $status = 'neutral';
        $reason = 'Insufficient data';
        $hours = $total_seconds / 3600;

        if ($this_week !== null) {
            $improvement = ($last_week !== null) ? ($this_week - $last_week) : 0;
            
            if ($this_week >= 80 || ($last_week !== null && $improvement >= 10)) {
                $status = 'efficient';
                $reason = ($this_week >= 80) ? "Mastery is high (".round($this_week, 1)."%)" : "Rapidly improving (+".round($improvement, 1)."%)";
            } elseif ($hours > 5 && $improvement < 2) {
                $status = 'empty';
                $reason = "High effort ($".round($hours,1)."h), low improvement";
            } elseif ($hours > 3) {
                $status = 'grinding';
                $reason = "Consistent effort, steady progress";
            }
        }

        $efficiency_data[$subject_id] = [
            'subject_name' => $subject_name,
            'status' => $status,
            'accuracy' =>  $this_week !== null ? round($this_week, 1) : null,
            'improvement' => $last_week !== null ? round($improvement, 1) : null,
            'hours_spent' => round($hours, 1),
            'reason' => $reason
        ];
    }

    echo json_encode([
        'success' => true,
        'data' => $efficiency_data
    ]);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
$conn->close();
?>
