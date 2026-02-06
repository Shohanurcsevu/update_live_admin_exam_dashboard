<?php
/**
 * Study Discipline Stats API
 * 
 * Calculates study consistency and streaks for each subject.
 */

require_once '../subject/db_connect.php';
header('Content-Type: application/json');

$query = "
    SELECT 
        id as subject_id,
        subject_name,
        last_study_at,
        study_streak,
        DATEDIFF(CURRENT_DATE, DATE(last_study_at)) as days_since_last_study
    FROM subjects
    WHERE is_deleted = 0
    ORDER BY days_since_last_study DESC, study_streak DESC
";

$result = $conn->query($query);
$stats = [];

if ($result) {
    while ($row = $result->fetch_assoc()) {
        $days = ($row['days_since_last_study'] !== null) ? intval($row['days_since_last_study']) : 999;
        
        $status = 'Neglected';
        $status_color = 'rose';
        if ($days <= 1) {
            $status = 'Consistent';
            $status_color = 'emerald';
        } elseif ($days <= 3) {
            $status = 'Needs Action';
            $status_color = 'amber';
        }

        $stats[] = [
            'subject_id' => intval($row['subject_id']),
            'subject_name' => $row['subject_name'],
            'last_study_at' => $row['last_study_at'],
            'study_streak' => intval($row['study_streak']),
            'days_since_last_study' => $days,
            'status' => $status,
            'status_color' => $status_color
        ];
    }
}

echo json_encode(['success' => true, 'data' => $stats]);

$conn->close();
?>
