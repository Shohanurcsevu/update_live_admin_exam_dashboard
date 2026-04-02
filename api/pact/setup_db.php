<?php
/**
 * RE-THINK: Daily Study Pact Database Setup
 * Purpose: Creates study_pacts table and adds tracking columns to study_sessions
 */
require_once __DIR__ . '/../subject/db_connect.php';

// CLI Detection (from global rules)
if (php_sapi_name() === 'cli') {
    // For local dev, might need specific overrides here
}

header('Content-Type: text/plain');

echo "--- RE-THINK: Daily Study Pact Migration ---\n";

// 1. Create study_pacts table
$sql_pacts = "
CREATE TABLE IF NOT EXISTS study_pacts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pact_date DATE NOT NULL UNIQUE,
    target_hours DECIMAL(4,2) DEFAULT 0.0,
    commitments JSON, -- [{type:'subject'|'lesson'|'topic', id:123, name:'Algebra'}]
    mini_goal TEXT NULL, -- TODAY'S MISSION
    actual_seconds INT DEFAULT 0,
    completed_topic_ids JSON, -- Array of IDs: [1, 2, 3] from exams
    status ENUM('active', 'kept', 'broken', 'skipped', 'late') DEFAULT 'active',
    is_shown BOOLEAN DEFAULT 0,
    is_acknowledged BOOLEAN DEFAULT 0, -- FOR REPORT CARDS
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
";

if ($conn->query($sql_pacts) === TRUE) {
    echo "✔ Table 'study_pacts' created or already exists.\n";
} else {
    die("✘ Error creating study_pacts: " . $conn->error . "\n");
}

// Ensure columns exist if table was already created
$check_cols = [
    'mini_goal'       => "TEXT NULL AFTER commitments",
    'is_acknowledged' => "BOOLEAN DEFAULT 0 AFTER is_shown"
];
foreach ($check_cols as $col => $def) {
    if ($conn->query("SHOW COLUMNS FROM study_pacts LIKE '$col'")->num_rows == 0) {
        $conn->query("ALTER TABLE study_pacts ADD COLUMN $col $def");
    }
}

// 2. Add lesson_id and topic_id to study_sessions
$cols = [
    'lesson_id'  => "INT NULL AFTER subject_name",
    'lesson_name' => "VARCHAR(255) NULL AFTER lesson_id",
    'topic_id'   => "INT NULL AFTER lesson_name",
    'topic_name' => "VARCHAR(255) NULL AFTER topic_id"
];

foreach ($cols as $col => $definition) {
    $check = $conn->query("SHOW COLUMNS FROM study_sessions LIKE '$col'");
    if ($check->num_rows == 0) {
        if ($conn->query("ALTER TABLE study_sessions ADD COLUMN $col $definition")) {
            echo "✔ Added column '$col' to 'study_sessions'.\n";
        } else {
            echo "✘ Error adding column '$col': " . $conn->error . "\n";
        }
    } else {
        echo "ℹ Column '$col' already exists in 'study_sessions'.\n";
    }
}

echo "--- Migration Complete ---\n";
$conn->close();
?>
