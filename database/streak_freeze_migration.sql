-- Streak Freeze Migration: Add freeze columns to user_streaks
-- freeze_available: 1 = can use this week, 0 = already used
-- last_freeze_date: The date the freeze was last consumed
-- freeze_used_count: Total lifetime freezes consumed (for stats)

ALTER TABLE `user_streaks` 
    ADD COLUMN `freeze_available` TINYINT(1) DEFAULT 1 AFTER `last_activity_date`,
    ADD COLUMN `last_freeze_date` DATE DEFAULT NULL AFTER `freeze_available`,
    ADD COLUMN `freeze_used_count` INT DEFAULT 0 AFTER `last_freeze_date`;
