<?php
/**
 * Backup Stats API — lightweight endpoint
 * Returns table names and row counts without exporting data.
 * GET /api/backup/stats.php
 */

require_once '../subject/db_connect.php';

$tables = [
    'subjects', 'lessons', 'topics', 'exams', 'questions',
    'performance', 'question_attempts', 'question_srs',
    'offline_exam_attempts', 'study_sessions', 'activity_log',
    'mistake_bank', 'flashcards', 'reading_logs', 'user_streaks',
    'job_countdown', 'trivia_snapshots', 'app_settings', 'bpm_logs',
    'active_exam_sessions', 'ai_instruction_presets', 'ai_prompt_presets', 'exam_presets', 'exam_setup_presets',
    'ai_usage_log', 'todays_exams_list',
];

$counts = [];
$totalRecords = 0;

foreach ($tables as $table) {
    $result = $conn->query("SELECT COUNT(*) AS cnt FROM `{$table}`");
    $row = $result ? $result->fetch_assoc() : null;
    $c = $row ? (int) $row['cnt'] : 0;
    $counts[$table] = $c;
    $totalRecords += $c;
    if ($result) $result->free();
}

$conn->close();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

echo json_encode([
    'tables'        => count($tables),
    'total_records' => $totalRecords,
    'per_table'     => $counts,
]);
