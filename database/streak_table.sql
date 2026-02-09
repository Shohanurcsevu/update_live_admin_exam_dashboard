CREATE TABLE IF NOT EXISTS `user_streaks` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `current_streak` INT DEFAULT 0,
    `longest_streak` INT DEFAULT 0,
    `last_activity_date` DATE DEFAULT NULL,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Initialize the single streak record
INSERT INTO `user_streaks` (`id`, `current_streak`, `longest_streak`, `last_activity_date`) 
VALUES (1, 0, 0, NULL)
ON DUPLICATE KEY UPDATE id=id;
