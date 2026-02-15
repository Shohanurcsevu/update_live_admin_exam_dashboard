-- Migration: Add priority column to questions table
-- Priority: 0 = normal (default), higher values = higher priority
-- Run this on your database before using the priority feature.

ALTER TABLE questions
ADD COLUMN priority INT(11) DEFAULT 0;
