-- Migration: Add type column to literary_terms table
-- Date: 2025-12-19

-- Add type column if it doesn't exist
ALTER TABLE literary_terms ADD COLUMN type TEXT;
