-- Optional: Add created_at column to exams table
-- This allows filtering by creation date instead of update date
-- Run this SQL in phpMyAdmin if you want to use created_at instead of updated_at

ALTER TABLE `exams` 
ADD COLUMN `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER `negative_mark_value`;

-- Optional: Add index for better performance
CREATE INDEX idx_exams_created_at ON exams(created_at);

-- After running this, change line 53 in exam.php back to:
-- $where_clauses[] = "DATE(e.created_at) BETWEEN ? AND ?";
