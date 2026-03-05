<?php
$_SERVER['HTTP_HOST'] = 'localhost';
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
require_once 'api/subject/db_connect.php';

// Helper function to check if a column exists
function columnExists($conn, $table, $column) {
    $result = $conn->query("SHOW COLUMNS FROM `$table` LIKE '$column'");
    return $result && $result->num_rows > 0;
}

// 1. subjects table: Add color_class ENUM
if (!columnExists($conn, 'subjects', 'color_class')) {
    $sql = "ALTER TABLE subjects ADD COLUMN color_class ENUM('emerald', 'indigo', 'amber', 'cyan', 'violet', 'rose', 'teal', 'orange', 'sky', 'fuchsia') NOT NULL DEFAULT 'violet' AFTER subject_name";
    if ($conn->query($sql)) {
        echo "Added color_class to subjects.\n";
    } else {
        echo "Error adding color_class to subjects: " . $conn->error . "\n";
    }
} else {
    // Update existing ENUM to include new colors
    $sql = "ALTER TABLE subjects MODIFY COLUMN color_class ENUM('emerald', 'indigo', 'amber', 'cyan', 'violet', 'rose', 'teal', 'orange', 'sky', 'fuchsia') NOT NULL DEFAULT 'violet'";
    if ($conn->query($sql)) {
        echo "Updated color_class ENUM with new colors.\n";
    } else {
        echo "Error updating color_class ENUM: " . $conn->error . "\n";
    }
}

// 2. lessons table: Add is_complete and completed_at
if (!columnExists($conn, 'lessons', 'is_complete')) {
    $sql = "ALTER TABLE lessons ADD COLUMN is_complete TINYINT(1) NOT NULL DEFAULT 0 AFTER py_bcs_ques";
    $conn->query($sql);
    echo "Added is_complete to lessons.\n";
} else {
    echo "Column is_complete already exists in lessons.\n";
}
if (!columnExists($conn, 'lessons', 'completed_at')) {
    $sql = "ALTER TABLE lessons ADD COLUMN completed_at TIMESTAMP NULL DEFAULT NULL AFTER is_complete";
    $conn->query($sql);
    echo "Added completed_at to lessons.\n";
} else {
    echo "Column completed_at already exists in lessons.\n";
}

// 3. Add Indexes to lessons table (IF NOT EXISTS via checking first)
function indexExists($conn, $table, $index_name) {
    $result = $conn->query("SHOW INDEX FROM `$table` WHERE Key_name = '$index_name'");
    return $result && $result->num_rows > 0;
}

$indexes = [
    'idx_subject_id' => "CREATE INDEX idx_subject_id ON lessons(subject_id)",
    'idx_is_complete' => "CREATE INDEX idx_is_complete ON lessons(is_complete)",
    'idx_is_deleted' => "CREATE INDEX idx_is_deleted ON lessons(is_deleted)",
    'idx_completed_at' => "CREATE INDEX idx_completed_at ON lessons(completed_at)"
];

foreach ($indexes as $name => $index_sql) {
    if (!indexExists($conn, 'lessons', $name)) {
        if ($conn->query($index_sql)) {
            echo "Created index: $name\n";
        } else {
            echo "Error creating index $name: " . $conn->error . "\n";
        }
    } else {
        echo "Index $name already exists.\n";
    }
}

// 4. Initialize subject colors
$color_map = [
    'emerald' => [1, 2],
    'indigo'  => [3, 4],
    'amber'   => [10, 11],
    'cyan'    => [8, 9],
    'rose'    => [5, 6],
    'teal'    => [7, 12],
    'orange'  => [13, 14],
    'sky'     => [15, 16],
    'fuchsia' => [17, 18],
    'violet'  => [19, 20, 21, 22, 23, 24, 25, 26, 27, 28] // Others
];

foreach ($color_map as $color => $ids) {
    $ids_str = implode(',', $ids);
    $sql = "UPDATE subjects SET color_class = '$color' WHERE id IN ($ids_str)";
    if ($conn->query($sql)) {
        echo "Updated subjects for color $color.\n";
    } else {
        echo "Error updating subjects for color $color: " . $conn->error . "\n";
    }
}

$conn->close();
?>
