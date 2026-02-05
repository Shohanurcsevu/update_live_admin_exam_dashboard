-- Database updates for Offline Exam Taking (Phase 2)

-- 1. Update questions table for incremental sync
ALTER TABLE questions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS is_deleted TINYINT(1) DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_questions_updated_at ON questions(updated_at);

-- 2. Create table for offline exam attempts
CREATE TABLE IF NOT EXISTS offline_exam_attempts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    attempt_uuid VARCHAR(36) UNIQUE NOT NULL, -- UUID generated on client
    exam_id INT NOT NULL,
    answers JSON NOT NULL, -- Format: { "q_id": "option_key" }
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    duration_used INT NOT NULL, -- in seconds
    score DECIMAL(10, 2) NOT NULL,
    score_with_negative DECIMAL(10, 2) NOT NULL,
    status ENUM('COMPLETED', 'SYNCED', 'REJECTED') DEFAULT 'COMPLETED',
    checksum VARCHAR(64) NOT NULL, -- For tamper detection
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sync_at TIMESTAMP NULL,
    FOREIGN KEY (exam_id) REFERENCES exams(id)
);

