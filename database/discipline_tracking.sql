-- Migration to add discipline tracking to subjects table
ALTER TABLE subjects ADD COLUMN last_study_at TIMESTAMP NULL DEFAULT NULL;
ALTER TABLE subjects ADD COLUMN study_streak INT DEFAULT 0;

-- Optional: Initialize last_study_at for existing subjects to avoid null issues in display
UPDATE subjects SET last_study_at = created_at WHERE last_study_at IS NULL;
