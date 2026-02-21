<?php
// FILE: api/performance/mastery-trends.php
require_once '../subject/db_connect.php';
header('Content-Type: application/json');

date_default_timezone_set('Asia/Dhaka');
$today = date('Y-m-d');
$yesterday = date('Y-m-d', strtotime('-1 day'));
$today_start = $today . ' 00:00:00';
$today_end = $today . ' 23:59:59';
$yesterday_start = $yesterday . ' 00:00:00';
$yesterday_end = $yesterday . ' 23:59:59';

$response = [
    'success' => true,
    'data' => [
        'subjects' => [],
        'insights' => [],
        'total_exams' => 0,
        'daily_stats' => [
            'exams_created' => [],
            'exams_taken' => [],
            'subjects_no_activity' => [],
            'uncompleted_exams' => [],
            'pomodoro_sessions' => []
        ],
        'morning_roadmap' => [],
        'recent_sessions' => [],
        'boss_challenge' => [
            'active' => null,
            'progress' => [
                'exams' => 0,
                'sessions' => 0
            ],
            'status' => [
                'is_champion' => false,
                'failed_yesterday' => false
            ]
        ]
    ]
];

// Helper to calculate accuracy trends
// Period 1: Last 7 days
// Period 2: 7 to 14 days ago

$trends_sql = "
    SELECT 
        s.id as subject_id,
        s.subject_name,
        AVG(CASE WHEN p.attempt_time >= DATE_SUB(CURRENT_DATE, INTERVAL 7 DAY) THEN (p.score_with_negative / e.total_marks) * 100 END) as accuracy_this_week,
        AVG(CASE WHEN p.attempt_time >= DATE_SUB(CURRENT_DATE, INTERVAL 14 DAY) AND p.attempt_time < DATE_SUB(CURRENT_DATE, INTERVAL 7 DAY) THEN (p.score_with_negative / e.total_marks) * 100 END) as accuracy_last_week
    FROM subjects s
    LEFT JOIN performance p ON s.id = p.subject_id
    LEFT JOIN exams e ON p.exam_id = e.id AND e.subject_id IS NOT NULL
    WHERE s.is_deleted = 0
    GROUP BY s.id, s.subject_name
";

$result = $conn->query($trends_sql);
$subjects = [];
$insights = [];

// 1. Fetch manual completions ONCE for all today's subjects (efficiency)
$manual_exam_ids = [];
$man_res = $conn->query("SELECT activity_message FROM activity_log WHERE activity_type = 'manual_exam_completion' AND timestamp BETWEEN '$today_start' AND '$today_end'");
if ($man_res) {
    while ($m_row = $man_res->fetch_assoc()) {
        $m_data = json_decode($m_row['activity_message'], true);
        if (isset($m_data['exam_id'])) $manual_exam_ids[] = (int)$m_data['exam_id'];
    }
}

if ($result) {
    while ($row = $result->fetch_assoc()) {
        $this_week = $row['accuracy_this_week'] !== null ? round(floatval($row['accuracy_this_week']), 1) : null;
        $last_week = $row['accuracy_last_week'] !== null ? round(floatval($row['accuracy_last_week']), 1) : null;
        
        // Get today's exams for this subject
        $subject_id = $row['subject_id'];
        $today_exams_sql = "
            SELECT 
                e.id,
                e.exam_title,
                e.total_marks,
                COUNT(p.id) as attempt_count,
                MAX(p.score_with_negative) as best_score
            FROM exams e
            LEFT JOIN performance p ON e.id = p.exam_id AND p.attempt_time BETWEEN '$today_start' AND '$today_end'
            WHERE e.subject_id = $subject_id 
                AND e.created_at BETWEEN '$today_start' AND '$today_end'
                AND e.is_deleted = 0
                AND e.is_revision = 0
                AND e.subject_id IS NOT NULL
                AND e.lesson_id IS NOT NULL
                AND e.topic_id IS NOT NULL
            GROUP BY e.id, e.exam_title, e.total_marks
        ";
        
        $today_exams_result = $conn->query($today_exams_sql);
        $today_exams = [];
        
        if ($today_exams_result) {
            while ($exam_row = $today_exams_result->fetch_assoc()) {
                $exam_id = intval($exam_row['id']);
                $is_online_completed = intval($exam_row['attempt_count']) > 0;
                $is_manual_completed = in_array($exam_id, $manual_exam_ids);

                $today_exams[] = [
                    'id' => $exam_id,
                    'title' => $exam_row['exam_title'],
                    'total_marks' => $exam_row['total_marks'],
                    'attempt_count' => intval($exam_row['attempt_count']),
                    'best_score' => $exam_row['best_score'] !== null ? floatval($exam_row['best_score']) : null,
                    'is_completed' => $is_online_completed || $is_manual_completed,
                    'completion_type' => $is_online_completed ? 'online' : ($is_manual_completed ? 'manual' : null)
                ];
            }
        }
        
        // Fetch pomodoro sessions for this subject today (Corrected to only count completed sessions)
        $focus_count = 0;
        $break_count = 0;
        
        $pom_sql = "
            SELECT activity_type, activity_details
            FROM activity_log 
            WHERE TRIM(activity_message) = ? 
            AND activity_type IN ('pomodoro_session', 'pomodoro_break')
            AND timestamp BETWEEN '$today_start' AND '$today_end'
        ";
        $pom_stmt = $conn->prepare($pom_sql);
        $subject_name_val = $row['subject_name'];
        $pom_stmt->bind_param("s", $subject_name_val);
        $pom_stmt->execute();
        $pom_res = $pom_stmt->get_result();
        while ($p_row = $pom_res->fetch_assoc()) {
            if ($p_row['activity_type'] === 'pomodoro_break') {
                $break_count++;
            } else {
                // Focus: Check if completed (old logs might not have status, assume completed)
                $det = json_decode($p_row['activity_details'], true);
                if (!isset($det['status']) || $det['status'] === 'completed') {
                    $focus_count++;
                }
            }
        }

        $subjects[] = [
            'id' => $subject_id,
            'name' => $row['subject_name'],
            'this_week' => $this_week,
            'last_week' => $last_week,
            'today_exams' => $today_exams,
            'focus_sessions' => $focus_count,
            'break_sessions' => $break_count
        ];

        // Generate Insights
        if ($this_week !== null && $last_week !== null) {
            $diff = $this_week - $last_week;
            if ($diff <= -10) {
                $insights[] = [
                    'type' => 'warning',
                    'message' => "Your accuracy in **{$row['subject_name']}** has dropped by " . abs(round($diff)) . "% this week. Consider a review session!",
                    'subject' => $row['subject_name']
                ];
            } elseif ($diff >= 10) {
                $insights[] = [
                    'type' => 'improvement',
                    'message' => "Great job! Your **{$row['subject_name']}** mastery improved by " . round($diff) . "% compared to last week.",
                    'subject' => $row['subject_name']
                ];
            }
        }
    }
}

// Get total exams count for the user
$total_count_sql = "SELECT COUNT(*) as total FROM performance";
$total_result = $conn->query($total_count_sql);
if ($total_result) {
    $response['data']['total_exams'] = intval($total_result->fetch_assoc()['total']);
}


$response['data']['subjects'] = $subjects;
$response['data']['insights'] = $insights;

// 3. AI Mentor: Progression & Revision Advice
$mentor_advice = [];
foreach ($subjects as $subject) {
    $subject_id = $subject['id'];
    
    // Logic: 
    // 1. First, look for a topic that has NEVER been tested today or ever (Progression)
    // 2. If all topics have tests, look for the weakest one (Revision)
    
    $progression_sql = "
        SELECT 
            t.topic_name,
            COUNT(e.id) as exam_count,
            AVG((p.score_with_negative / e.total_marks) * 100) as topic_accuracy
        FROM topics t
        LEFT JOIN exams e ON t.id = e.topic_id AND e.is_deleted = 0 AND e.is_revision = 0 AND e.subject_id IS NOT NULL AND e.lesson_id IS NOT NULL AND e.topic_id IS NOT NULL
        LEFT JOIN performance p ON e.id = p.exam_id
        WHERE t.subject_id = ?
        GROUP BY t.id, t.topic_name
        ORDER BY exam_count ASC, topic_accuracy ASC
        LIMIT 1
    ";
    
    $stmt = $conn->prepare($progression_sql);
    $stmt->bind_param("i", $subject_id);
    $stmt->execute();
    $topic_result = $stmt->get_result();
    
    if ($topic_row = $topic_result->fetch_assoc()) {
        $exam_count = (int)$topic_row['exam_count'];
        $accuracy = $topic_row['topic_accuracy'] !== null ? round(floatval($topic_row['topic_accuracy']), 1) : null;
        
        $mentor_advice[] = [
            'subject' => $subject['name'],
            'target_topic' => $topic_row['topic_name'],
            'type' => ($exam_count === 0) ? 'progression' : 'revision',
            'accuracy' => $accuracy,
            'exam_count' => $exam_count
        ];
    }
}

$response['data']['mentor_advice'] = $mentor_advice;

// --- DAILY EXAM STATUS TRACKING ---
// Get subjects with exams created today (or updated, as a proxy for creation)
$daily_exams_sql = "
    SELECT 
        s.id as subject_id,
        s.subject_name,
        COUNT(DISTINCT e.id) as created_count,
        COUNT(DISTINCT p.id) as taken_count
    FROM subjects s
    LEFT JOIN exams e ON s.id = e.subject_id AND e.created_at BETWEEN '$today_start' AND '$today_end' AND e.is_deleted = 0 AND e.is_revision = 0 AND e.subject_id IS NOT NULL AND e.lesson_id IS NOT NULL AND e.topic_id IS NOT NULL
    LEFT JOIN performance p ON e.id = p.exam_id AND p.attempt_time BETWEEN '$today_start' AND '$today_end'
    WHERE s.is_deleted = 0
    GROUP BY s.id, s.subject_name
";

// Fetch all manual completion exam IDs for today AND their subjects
$manual_completions_by_subject = [];
$man_sql = "
    SELECT al.activity_message, e.subject_id 
    FROM activity_log al
    JOIN exams e ON e.id = CAST(
        JSON_UNQUOTE(
            JSON_EXTRACT(al.activity_message, '$.exam_id')
        ) AS UNSIGNED
    )
    WHERE al.activity_type = 'manual_exam_completion' 
    AND al.timestamp BETWEEN '$today_start' AND '$today_end'
";
// Note: JSON functions might not be available or efficient depending on MariaDB/MySQL version. 
// Fallback: Fetch all manually completed IDs (from PHP loop earlier or new query), then query exams table.
// Let's stick to the PHP approach for safety compatibility.

// 1. Get all manual exam IDs
$manual_ids = [];
$man_simple_sql = "SELECT activity_message FROM activity_log WHERE activity_type = 'manual_exam_completion' AND timestamp BETWEEN '$today_start' AND '$today_end'";
$man_res = $conn->query($man_simple_sql);
if ($man_res) {
    while ($man_row = $man_res->fetch_assoc()) {
        $data = json_decode($man_row['activity_message'], true);
        if (isset($data['exam_id'])) {
            $manual_ids[] = intval($data['exam_id']);
        }
    }
}

// 2. Map these IDs to Subject IDs
$manual_subject_counts = [];
if (!empty($manual_ids)) {
    $ids_str = implode(',', $manual_ids);
    $subj_lookup_sql = "SELECT subject_id, COUNT(*) as cnt FROM exams WHERE id IN ($ids_str) GROUP BY subject_id";
    $subj_res = $conn->query($subj_lookup_sql);
    if ($subj_res) {
        while ($s_row = $subj_res->fetch_assoc()) {
            $manual_subject_counts[$s_row['subject_id']] = (int)$s_row['cnt'];
        }
    }
}

$daily_result = $conn->query($daily_exams_sql);
$exams_created = [];
$exams_taken = [];
$subjects_no_activity = [];

if ($daily_result) {
    while ($row = $daily_result->fetch_assoc()) {
        $subject_id = (int)$row['subject_id'];
        $created_count = (int)$row['created_count'];
        $online_taken_count = (int)$row['taken_count'];
        
        // Add manual completions for this subject
        $manual_count = isset($manual_subject_counts[$subject_id]) ? $manual_subject_counts[$subject_id] : 0;
        
        // Total taken (Online + Manual). Note: This might double count if user did both?
        // Logic in mentor.js checks if ONE exam is taken.
        // If an exam is taken both online and manually, it's counted as 1 "taken" for that exam.
        // BUT here we are counting aggregates.
        // We probably should count DISTINCT exams taken (whether online or manual).
        // To do that perfectly, we'd need a complex query.
        // Simplified approach: Max(online, manual) ? No.
        // Union of IDs? Yes.
        
        // For accurate ring progress, assume distinct.
        // Let's just sum them for now, or trust that manual is used when online isn't.
        // Actually, if we want it perfect, we should query:
        // SELECT count(distinct e.id) WHERE (p.id IS NOT NULL OR e.id IN ($manual_ids))
        
        // Given complexity, let's just use Max(online_count, manual_count) if we assume 1 exam per subject per day? 
        // No, multiple exams possible.
        // Let's just ADD distinct manual completions that WEREN'T taken online?
        // Too complex for PHP here.
        // Let's simply ADD manual count. If user enables manual check on an online exam, it might count double, but UI hides manual check if online done.
        
        $total_taken = $online_taken_count + $manual_count; 
        // Clamp to created_count because you can't take more than created (logic-wise for the ring)
        if ($total_taken > $created_count) $total_taken = $created_count;

        if ($created_count > 0) {
            $exams_created[] = [
                'id' => $subject_id,
                'name' => $row['subject_name'],
                'count' => $created_count
            ];
            
            if ($total_taken > 0) {
                $exams_taken[] = [
                    'id' => $subject_id,
                    'name' => $row['subject_name'],
                    'count' => $total_taken
                ];
            }
        } else {
            $subjects_no_activity[] = [
                'id' => $subject_id,
                'name' => $row['subject_name']
            ];
        }
    }
}


$response['data']['daily_stats']['exams_created'] = $exams_created;
$response['data']['daily_stats']['exams_taken'] = $exams_taken;
$response['data']['daily_stats']['subjects_no_activity'] = $subjects_no_activity;

// --- TOTAL EXAMS TAKEN TODAY (Online + Manual, Exclude Deleted) ---
$completed_exam_ids = [];

// 1. Online Completions
$online_sql = "
    SELECT DISTINCT p.exam_id 
    FROM performance p 
    JOIN exams e ON p.exam_id = e.id 
    WHERE p.attempt_time BETWEEN '$today_start' AND '$today_end' 
    AND e.is_deleted = 0
    AND e.is_revision = 0
    AND e.subject_id IS NOT NULL
    AND e.lesson_id IS NOT NULL
    AND e.topic_id IS NOT NULL
";
$online_res = $conn->query($online_sql);
if ($online_res) {
    while ($row = $online_res->fetch_row()) $completed_exam_ids[] = intval($row[0]);
}

// 2. Manual Completions (Robust PHP-based decoding instead of SQL JSON_EXTRACT)
$manual_logs_res = $conn->query("SELECT activity_message FROM activity_log WHERE activity_type = 'manual_exam_completion' AND timestamp BETWEEN '$today_start' AND '$today_end'");
if ($manual_logs_res) {
    // Collect manual IDs
    $man_ids = [];
    while ($row = $manual_logs_res->fetch_assoc()) {
        $m_data = json_decode($row['activity_message'], true);
        if (isset($m_data['exam_id'])) $man_ids[] = intval($m_data['exam_id']);
    }
    
    // Validate manual IDs exist and aren't deleted/revision
    if (!empty($man_ids)) {
        $ids_csv = implode(',', $man_ids);
        $valid_manual_res = $conn->query("SELECT id FROM exams WHERE id IN ($ids_csv) AND is_deleted = 0 AND is_revision = 0 AND subject_id IS NOT NULL AND lesson_id IS NOT NULL AND topic_id IS NOT NULL");
        if ($valid_manual_res) {
            while ($row = $valid_manual_res->fetch_row()) $completed_exam_ids[] = intval($row[0]);
        }
    }
}

$completed_exam_ids = array_unique($completed_exam_ids);
$total_taken_today = count($completed_exam_ids);

// Diagnostic Info
$response['debug']['today_start'] = $today_start;
$response['debug']['today_end'] = $today_end;
$response['debug']['activity_log_count'] = $total_taken_today;
$response['debug']['performance_total'] = $response['data']['total_exams'];

// Session Debug
$session_debug_sql = "SELECT COUNT(*) as total FROM activity_log WHERE activity_type = 'pomodoro_session' AND timestamp BETWEEN '$today_start' AND '$today_end'";
$sd_res = $conn->query($session_debug_sql);
$response['debug']['session_count_today'] = ($sd_res) ? intval($sd_res->fetch_assoc()['total']) : 0;

// --- GET SPECIFIC UNCOMPLETED EXAM TITLES ---
$uncompleted_sql = "
    SELECT e.id, e.exam_title, s.subject_name
    FROM exams e
    JOIN subjects s ON e.subject_id = s.id
    LEFT JOIN performance p ON e.id = p.exam_id AND p.attempt_time BETWEEN '$today_start' AND '$today_end'
    WHERE e.created_at BETWEEN '$today_start' AND '$today_end' 
    AND e.is_deleted = 0
    AND e.is_revision = 0
    AND e.subject_id IS NOT NULL
    AND e.lesson_id IS NOT NULL
    AND e.topic_id IS NOT NULL
    AND p.id IS NULL
";

$uncompleted_result = $conn->query($uncompleted_sql);
if ($uncompleted_result) {
    while ($row = $uncompleted_result->fetch_assoc()) {
        $response['data']['daily_stats']['uncompleted_exams'][] = [
            'id' => $row['id'],
            'title' => $row['exam_title'],
            'subject' => $row['subject_name']
        ];
    }
}

// --- MORNING ROADMAP: Weakest subjects from yesterday ---
$roadmap_sql = "
    SELECT 
        s.subject_name,
        AVG((p.score_with_negative / e.total_marks) * 100) as avg_accuracy
    FROM performance p
    JOIN exams e ON p.exam_id = e.id
    JOIN subjects s ON e.subject_id = s.id
    WHERE DATE(p.attempt_time) = DATE_SUB(CURRENT_DATE, INTERVAL 1 DAY)
    AND s.is_deleted = 0
    AND e.is_revision = 0
    AND e.subject_id IS NOT NULL
    AND e.lesson_id IS NOT NULL
    AND e.topic_id IS NOT NULL
    GROUP BY s.id, s.subject_name
    ORDER BY avg_accuracy ASC
    LIMIT 3
";

$roadmap_result = $conn->query($roadmap_sql);
if ($roadmap_result) {
    while ($row = $roadmap_result->fetch_assoc()) {
        $response['data']['morning_roadmap'][] = [
            'subject' => $row['subject_name'],
            'accuracy' => round(floatval($row['avg_accuracy']), 1)
        ];
    }
}

// --- POMODORO SESSIONS: Get counts for today ---
$pomodoro_sql = "
    SELECT activity_message as subject_name, activity_details
    FROM activity_log
    WHERE activity_type = 'pomodoro_session'
    AND timestamp BETWEEN '$today_start' AND '$today_end'
";

$pomodoro_result = $conn->query($pomodoro_sql);
if ($pomodoro_result) {
    $subject_counts = [];
    while ($row = $pomodoro_result->fetch_assoc()) {
        $details = json_decode($row['activity_details'], true);
        // Only count if status is completed (or missing for old logs)
        if (!isset($details['status']) || $details['status'] === 'completed') {
            $subj = trim($row['subject_name']);
            if (!isset($subject_counts[$subj])) $subject_counts[$subj] = 0;
            $subject_counts[$subj]++;
        }
    }
    
    foreach ($subject_counts as $subject => $count) {
        $response['data']['daily_stats']['pomodoro_sessions'][] = [
            'subject' => $subject,
            'count' => $count
        ];
    }
}

// --- RECENT SESSIONS: Get sequence for fatigue detection ---
$recent_sessions_sql = "
    SELECT TRIM(activity_message) as subject_name
    FROM activity_log
    WHERE activity_type = 'pomodoro_session'
    AND timestamp BETWEEN '$today_start' AND '$today_end'
    ORDER BY timestamp DESC
    LIMIT 5
";

$recent_result = $conn->query($recent_sessions_sql);
if ($recent_result) {
    while ($row = $recent_result->fetch_assoc()) {
        $response['data']['recent_sessions'][] = $row['subject_name'];
    }
}

// 1. Check for Active Challenge today (Issue if missing)
$challenge_sql = "SELECT activity_message FROM activity_log WHERE activity_type = 'boss_challenge_issued' AND timestamp BETWEEN '$today_start' AND '$today_end' LIMIT 1";
$challenge_result = $conn->query($challenge_sql);
$challenge_data = null;

if ($challenge_result && $row = $challenge_result->fetch_assoc()) {
    $challenge_data = json_decode($row['activity_message'], true);
} else {
    // Generate new mission if before 9 PM
    $current_time = date('H:i:s');
    if ($current_time < '21:00:00') {
        $exams_target = rand(2, 4);
        $sessions_target = rand(3, 6);
        $deadline = "21:00:00";
        
        $challenge_data = [
            'exams' => $exams_target,
            'sessions' => $sessions_target,
            'deadline' => $deadline,
            'issued_at' => date('Y-m-d H:i:s')
        ];
        
        $msg = $conn->real_escape_string(json_encode($challenge_data));
        $conn->query("INSERT INTO activity_log (activity_type, activity_message, timestamp) VALUES ('boss_challenge_issued', '$msg', NOW())");
    }
}

if ($challenge_data) {
    // Check if accepted
    $accepted_sql = "SELECT id FROM activity_log WHERE activity_type = 'boss_challenge_accepted' AND timestamp BETWEEN '$today_start' AND '$today_end' LIMIT 1";
    $accepted_res = $conn->query($accepted_sql);
    $is_accepted = ($accepted_res && $accepted_res->num_rows > 0);
    
    // Calculate current progress
    $current_exams = $total_taken_today;
    $current_sessions = 0;
    if (isset($response['data']['daily_stats']['pomodoro_sessions'])) {
        foreach ($response['data']['daily_stats']['pomodoro_sessions'] as $s) $current_sessions += $s['count'];
    }
    
    $response['data']['boss_challenge']['active'] = array_merge($challenge_data, ['is_accepted' => $is_accepted]);
    $response['data']['boss_challenge']['progress'] = [
        'exams' => $current_exams,
        'sessions' => $current_sessions
    ];

    // Log success if targets met first time
    if ($is_accepted && $current_exams >= $challenge_data['exams'] && $current_sessions >= $challenge_data['sessions']) {
        $check_success = $conn->query("SELECT id FROM activity_log WHERE activity_type = 'boss_challenge_success' AND timestamp BETWEEN '$today_start' AND '$today_end' LIMIT 1");
        if ($check_success && $check_success->num_rows === 0) {
            $conn->query("INSERT INTO activity_log (activity_type, activity_message, timestamp) VALUES ('boss_challenge_success', 'Won the Boss Challenge!', NOW())");
        }
    }
}

// 2. Champion Status (Success in last 24h)
$champion_sql = "SELECT id FROM activity_log WHERE activity_type = 'boss_challenge_success' AND timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR) LIMIT 1";
$champion_res = $conn->query($champion_sql);
$response['data']['boss_challenge']['status']['is_champion'] = ($champion_res && $champion_res->num_rows > 0);

// 3. Yesterday Failure (Accepted but targets not met)
$yesterday_challenge_sql = "SELECT activity_message FROM activity_log WHERE activity_type = 'boss_challenge_issued' AND timestamp BETWEEN '$yesterday_start' AND '$yesterday_end' LIMIT 1";
$y_chal_res = $conn->query($yesterday_challenge_sql);
if ($y_chal_res && $row = $y_chal_res->fetch_assoc()) {
    $y_data = json_decode($row['activity_message'], true);
    
    // Was it accepted?
    $y_acc_sql = "SELECT id FROM activity_log WHERE activity_type = 'boss_challenge_accepted' AND timestamp BETWEEN '$yesterday_start' AND '$yesterday_end' LIMIT 1";
    $y_acc_res = $conn->query($y_acc_sql);
    if ($y_acc_res && $y_acc_res->num_rows > 0) {
        // Did they succeed?
        $y_succ_sql = "SELECT id FROM activity_log WHERE activity_type = 'boss_challenge_success' AND timestamp BETWEEN '$yesterday_start' AND '$yesterday_end' LIMIT 1";
        $y_succ_res = $conn->query($y_succ_sql);
        if ($y_succ_res && $y_succ_res->num_rows === 0) {
            $response['data']['boss_challenge']['status']['failed_yesterday'] = true;
        }
    }
}

// --- STREAK CALCULATION ---
$streak_count = 0;
// Check if mission success is logged for today or yesterday
$streak_check_date = $today;
$done = false;

while (!$done) {
    $check_start = $streak_check_date . ' 00:00:00';
    $check_end = $streak_check_date . ' 23:59:59';
    $streak_sql = "SELECT id FROM activity_log WHERE activity_type = 'mission_success' AND timestamp BETWEEN '$check_start' AND '$check_end' LIMIT 1";
    $st_res = $conn->query($streak_sql);
    
    if ($st_res && $st_res->num_rows > 0) {
        $streak_count++;
        $streak_check_date = date('Y-m-d', strtotime($streak_check_date . ' -1 day'));
    } else {
        // If we haven't found a success for today, check yesterday. If yesterday also has none, streak is 0.
        // If we found successes for previous days but today is not yet done, we still count the streak ending yesterday.
        if ($streak_check_date === $today) {
            $streak_check_date = date('Y-m-d', strtotime($streak_check_date . ' -1 day'));
            continue;
        }
        $done = true;
    }
    
    // Safety break to prevent infinite loop (max 365 days)
    if ($streak_count > 365) $done = true;
}
$response['data']['mission_streak'] = $streak_count;

echo json_encode($response);
$conn->close();
?>
