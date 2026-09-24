-- ============================================================
-- Written Exam Module Migration
-- Safe: uses IF NOT EXISTS, does not touch existing data
-- Run once against admin_examtaking database
-- ============================================================

-- 1. Add exam_type to existing exams table (defaults to 'mcq' -> no disruption)
ALTER TABLE `exams`
  ADD COLUMN IF NOT EXISTS `exam_type` ENUM('mcq','written','mixed') NOT NULL DEFAULT 'mcq' AFTER `is_revision`;

-- 2. Written question bank
CREATE TABLE IF NOT EXISTS `written_questions` (
  `id`             INT(11) NOT NULL AUTO_INCREMENT,
  `subject_id`     INT(11) DEFAULT NULL,
  `lesson_id`      INT(11) DEFAULT NULL,
  `topic_id`       INT(11) DEFAULT NULL,
  `question_text`  MEDIUMTEXT NOT NULL,
  `question_type`  VARCHAR(60) NOT NULL DEFAULT 'short_answer',
  `difficulty`     ENUM('easy','medium','hard') NOT NULL DEFAULT 'medium',
  `marks`          DECIMAL(6,2) NOT NULL DEFAULT 1.00,
  `model_answer`   MEDIUMTEXT DEFAULT NULL,
  `image_path`     VARCHAR(500) DEFAULT NULL,
  `has_formula`    TINYINT(1) NOT NULL DEFAULT 0,
  `language`       VARCHAR(20) NOT NULL DEFAULT 'mixed',
  `is_active`      TINYINT(1) NOT NULL DEFAULT 1,
  `created_at`     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_subject` (`subject_id`),
  KEY `idx_lesson`  (`lesson_id`),
  KEY `idx_topic`   (`topic_id`),
  KEY `idx_type`    (`question_type`),
  KEY `idx_active`  (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Sub-questions
CREATE TABLE IF NOT EXISTS `written_sub_questions` (
  `id`                  INT(11) NOT NULL AUTO_INCREMENT,
  `parent_question_id`  INT(11) NOT NULL,
  `sub_question_text`   MEDIUMTEXT NOT NULL,
  `marks`               DECIMAL(6,2) NOT NULL DEFAULT 1.00,
  `model_answer`        MEDIUMTEXT DEFAULT NULL,
  `image_path`          VARCHAR(500) DEFAULT NULL,
  `has_formula`         TINYINT(1) NOT NULL DEFAULT 0,
  `display_order`       INT(11) NOT NULL DEFAULT 0,
  `created_at`          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_parent` (`parent_question_id`),
  CONSTRAINT `fk_wsq_parent`
    FOREIGN KEY (`parent_question_id`) REFERENCES `written_questions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Sections within a written/mixed exam
CREATE TABLE IF NOT EXISTS `written_exam_sections` (
  `id`                   INT(11) NOT NULL AUTO_INCREMENT,
  `exam_id`              INT(11) NOT NULL,
  `section_title`        VARCHAR(255) DEFAULT NULL,
  `section_instructions` TEXT DEFAULT NULL,
  `display_order`        INT(11) NOT NULL DEFAULT 0,
  `created_at`           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_exam` (`exam_id`),
  CONSTRAINT `fk_wes_exam`
    FOREIGN KEY (`exam_id`) REFERENCES `exams` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Written questions assigned to an exam (SNAPSHOT approach)
CREATE TABLE IF NOT EXISTS `written_exam_questions` (
  `id`                  INT(11) NOT NULL AUTO_INCREMENT,
  `exam_id`             INT(11) NOT NULL,
  `section_id`          INT(11) DEFAULT NULL,
  `source_question_id`  INT(11) DEFAULT NULL,
  `question_text`       MEDIUMTEXT NOT NULL,
  `question_type`       VARCHAR(60) DEFAULT 'short_answer',
  `marks`               DECIMAL(6,2) NOT NULL DEFAULT 1.00,
  `image_path`          VARCHAR(500) DEFAULT NULL,
  `has_formula`         TINYINT(1) NOT NULL DEFAULT 0,
  `display_order`       INT(11) NOT NULL DEFAULT 0,
  `answer_space`        ENUM('small','medium','large','custom') NOT NULL DEFAULT 'medium',
  `answer_space_lines`  INT(11) NOT NULL DEFAULT 8,
  `created_at`          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_exam`    (`exam_id`),
  KEY `idx_section` (`section_id`),
  CONSTRAINT `fk_weq_exam`
    FOREIGN KEY (`exam_id`) REFERENCES `exams` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Sub-questions snapshot for each exam question
CREATE TABLE IF NOT EXISTS `written_exam_sub_questions` (
  `id`               INT(11) NOT NULL AUTO_INCREMENT,
  `exam_question_id` INT(11) NOT NULL,
  `sub_question_text` MEDIUMTEXT NOT NULL,
  `marks`             DECIMAL(6,2) NOT NULL DEFAULT 1.00,
  `image_path`        VARCHAR(500) DEFAULT NULL,
  `has_formula`       TINYINT(1) NOT NULL DEFAULT 0,
  `display_order`     INT(11) NOT NULL DEFAULT 0,
  `answer_space`      ENUM('small','medium','large','custom') NOT NULL DEFAULT 'small',
  `answer_space_lines` INT(11) NOT NULL DEFAULT 4,
  PRIMARY KEY (`id`),
  KEY `idx_eq` (`exam_question_id`),
  CONSTRAINT `fk_wesq_eq`
    FOREIGN KEY (`exam_question_id`) REFERENCES `written_exam_questions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
