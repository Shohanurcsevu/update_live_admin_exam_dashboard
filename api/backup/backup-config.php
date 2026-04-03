<?php
/**
 * Backup Configuration — Single Source of Truth
 * ═══════════════════════════════════════════════
 * AUTO-DETECTS tables from the database via SHOW TABLES.
 * The hardcoded BACKUP_TABLES list serves as a FALLBACK only
 * (for fresh machines where the DB/tables don't exist yet).
 *
 * Used by: stats.php, export.php, export-chunk.php, import.php,
 *          import-chunk.php, auto-backup.php, maintenance.php
 */

// ─── Known tables (fallback for fresh machines / import ordering) ─────────────
// This list is ONLY used when the database can't be queried (e.g. fresh install).
// For all normal operations, tables are auto-detected via SHOW TABLES.

const BACKUP_TABLES_FALLBACK = [
    'subjects',
    'lessons',
    'topics',
    'exams',
    'questions',
    'performance',
    'question_attempts',
    'question_srs',
    'offline_exam_attempts',
    'study_sessions',
    'activity_log',
    'mistake_bank',
    'flashcards',
    'reading_logs',
    'user_streaks',
    'job_countdown',
    'trivia_snapshots',
    'app_settings',
    'bpm_logs',
    'active_exam_sessions',
    'ai_instruction_presets',
    'ai_prompt_presets',
    'exam_presets',
    'exam_setup_presets',
    'ai_usage_log',
    'todays_exams_list',
    'streak_activity_log',
    'study_pacts',
];

// ─── Auto-detect tables from database ────────────────────────────────────────
// Queries SHOW TABLES and returns whatever actually exists in the DB.
// Falls back to the hardcoded list if the DB isn't available.

function get_backup_tables(mysqli $conn): array {
    $tables = [];
    $result = @$conn->query("SHOW TABLES");
    if ($result) {
        while ($row = $result->fetch_row()) {
            $tables[] = $row[0];
        }
        $result->free();
    }
    return !empty($tables) ? $tables : BACKUP_TABLES_FALLBACK;
}

// For backward compatibility — files that use `BACKUP_TABLES` constant
// will get the fallback list. Files that have $conn should use get_backup_tables($conn).
define('BACKUP_TABLES', BACKUP_TABLES_FALLBACK);

// ─── Tables eligible for date-based cleanup (maintenance.php) ────────────────

const CLEANUP_TABLES = [
    'activity_log' => ['date_col' => 'timestamp', 'label' => 'Activity Log'],
];

// ─── UI Labels & Icons ───────────────────────────────────────────────────────
// Maps table name → human-readable label + Material icon.
// Used by stats.php to send metadata to the frontend.

const TABLE_META = [
    'subjects'               => ['label' => 'Subjects',          'icon' => 'subject'],
    'lessons'                => ['label' => 'Lessons',           'icon' => 'library_books'],
    'topics'                 => ['label' => 'Topics',            'icon' => 'topic'],
    'exams'                  => ['label' => 'Exams',             'icon' => 'quiz'],
    'questions'              => ['label' => 'Questions',         'icon' => 'help_center'],
    'performance'            => ['label' => 'Performance',       'icon' => 'fact_check'],
    'question_attempts'      => ['label' => 'Q. Attempts',       'icon' => 'edit_note'],
    'question_srs'           => ['label' => 'SRS Data',          'icon' => 'history_edu'],
    'offline_exam_attempts'  => ['label' => 'Offline Attempts',  'icon' => 'offline_pin'],
    'study_sessions'         => ['label' => 'Study Sessions',    'icon' => 'schedule'],
    'activity_log'           => ['label' => 'Activity Log',      'icon' => 'timeline'],
    'mistake_bank'           => ['label' => 'Mistake Bank',      'icon' => 'psychology'],
    'flashcards'             => ['label' => 'Flashcards',        'icon' => 'style'],
    'reading_logs'           => ['label' => 'Reading Logs',      'icon' => 'book'],
    'user_streaks'           => ['label' => 'Streaks',           'icon' => 'local_fire_department'],
    'job_countdown'          => ['label' => 'Job Countdown',     'icon' => 'timer'],
    'trivia_snapshots'       => ['label' => 'Trivia Scores',     'icon' => 'emoji_events'],
    'app_settings'           => ['label' => 'App Settings',      'icon' => 'settings'],
    'bpm_logs'               => ['label' => 'BPM History',       'icon' => 'favorite'],
    'active_exam_sessions'   => ['label' => 'Active Sessions',   'icon' => 'timer'],
    'ai_instruction_presets' => ['label' => 'AI Presets',        'icon' => 'smart_toy'],
    'ai_prompt_presets'      => ['label' => 'Prompt Presets',    'icon' => 'settings_suggest'],
    'exam_presets'           => ['label' => 'Exam Presets',      'icon' => 'settings_backup_restore'],
    'exam_setup_presets'     => ['label' => 'Setup Presets',     'icon' => 'tune'],
    'ai_usage_log'           => ['label' => 'AI Usage Log',      'icon' => 'receipt_long'],
    'todays_exams_list'      => ['label' => 'Today\'s Exams',    'icon' => 'list_alt'],
    'streak_activity_log'    => ['label' => 'Streak Activity',   'icon' => 'local_fire_department'],
    'study_pacts'            => ['label' => 'Study Pacts',       'icon' => 'handshake'],
];

// Default icon/label for any NEW table not yet in TABLE_META
function get_table_meta(string $table): array {
    if (isset(TABLE_META[$table])) {
        return TABLE_META[$table];
    }
    // Auto-generate label from table name: "some_table" → "Some Table"
    return [
        'label' => ucwords(str_replace('_', ' ', $table)),
        'icon'  => 'table_chart',  // generic table icon
    ];
}
