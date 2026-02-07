-- Mistake Bank Table Schema
-- Tracks all incorrect answers across all exams (Online, Offline, Custom)

CREATE TABLE IF NOT EXISTS mistake_bank (
    id INT AUTO_INCREMENT PRIMARY KEY,
    question_id INT NOT NULL,
    exam_id INT NULL, -- Can be NULL for dynamic/mystery custom quizzes
    subject_id INT NULL,
    lesson_id INT NULL,
    topic_id INT NULL,
    mistake_count INT DEFAULT 1,
    is_custom TINYINT(1) DEFAULT 0, -- 1 if from custom exam / Mystery Custom
    is_offline TINYINT(1) DEFAULT 0, -- 1 if from offline exam engine
    last_missed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    resolved TINYINT(1) DEFAULT 0, -- 0 = active mistake, 1 = resolved correctly
    UNIQUE KEY (question_id, exam_id) -- Allows one record per question PER EXAM
);

-- Index for fast lookup for Mastery Quizzes
CREATE INDEX IF NOT EXISTS idx_mistake_bank_resolved ON mistake_bank(resolved);
CREATE INDEX IF NOT EXISTS idx_mistake_bank_count ON mistake_bank(mistake_count);
CREATE INDEX IF NOT EXISTS idx_mistake_bank_exam ON mistake_bank(exam_id);
