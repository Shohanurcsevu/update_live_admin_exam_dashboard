-- Migration: Create exam_presets table for lesson-wise exam presets
-- Run this SQL on the admin_examtaking database

CREATE TABLE IF NOT EXISTS `exam_presets` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `preset_name` VARCHAR(255) NOT NULL,
  `lessons_data` TEXT NOT NULL COMMENT 'JSON array of {lesson_id, lesson_name, question_count}',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
