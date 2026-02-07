-- Spaced Repetition Flashcards Database Schema
-- Creates the flashcards table with Leitner system support

CREATE TABLE IF NOT EXISTS flashcards (
    id INT PRIMARY KEY AUTO_INCREMENT,
    question_id INT NOT NULL,
    box_level TINYINT DEFAULT 1 COMMENT 'Leitner boxes: 1=daily, 2=3days, 3=7days, 4=14days, 5=30days',
    last_reviewed DATETIME,
    next_review DATE,
    times_reviewed INT DEFAULT 0,
    times_correct INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
    INDEX idx_next_review (next_review),
    INDEX idx_question (question_id),
    INDEX idx_box_level (box_level),
    UNIQUE KEY unique_question (question_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add index to mistake_bank for efficient flashcard generation
ALTER TABLE mistake_bank 
ADD INDEX IF NOT EXISTS idx_question (question_id);
