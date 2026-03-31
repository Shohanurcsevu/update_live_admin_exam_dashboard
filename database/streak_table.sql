CREATE TABLE IF NOT EXISTS `user_streaks` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `current_streak` INT DEFAULT 0,
    `longest_streak` INT DEFAULT 0,
    `last_activity_date` DATE DEFAULT NULL,
    `freeze_available` TINYINT(1) DEFAULT 1,
    `last_freeze_date` DATE DEFAULT NULL,
    `freeze_used_count` INT DEFAULT 0,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Initialize the single streak record
INSERT INTO `user_streaks` (`id`, `current_streak`, `longest_streak`, `last_activity_date`, `freeze_available`) 
VALUES (1, 0, 0, NULL, 1)
ON DUPLICATE KEY UPDATE id=id;
