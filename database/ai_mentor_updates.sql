-- AI Mentor Features Database Updates

-- 1. Ensure activity_log table exists (Core for recent activity and study tracking)
CREATE TABLE IF NOT EXISTS `activity_log` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `activity_type` VARCHAR(255) NOT NULL,
    `activity_message` TEXT NOT NULL,
    `activity_details` JSON DEFAULT NULL, -- Added for extra metadata if needed
    `timestamp` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Add activity_details column to your existing table
ALTER TABLE `activity_log` ADD COLUMN `activity_details` JSON DEFAULT NULL AFTER `activity_message`;

-- 3. Ensure subjects table has discipline tracking columns
ALTER TABLE `subjects` ADD COLUMN IF NOT EXISTS `last_study_at` TIMESTAMP NULL DEFAULT NULL;
ALTER TABLE `subjects` ADD COLUMN IF NOT EXISTS `study_streak` INT DEFAULT 0;
ALTER TABLE `subjects` ADD COLUMN IF NOT EXISTS `is_deleted` TINYINT(1) DEFAULT 0;
