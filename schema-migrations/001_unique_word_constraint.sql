-- Migration: Add unique constraint on lowercase item words
-- Date: 2025-12-14
-- Purpose: Prevent duplicate items with same word (case-insensitive)

-- Step 1: Check for existing duplicates before migration
-- Run this query first to identify duplicates that need to be resolved:
-- SELECT LOWER(word) as lower_word, COUNT(*) as count 
-- FROM items 
-- GROUP BY LOWER(word) 
-- HAVING COUNT(*) > 1;

-- Step 2: Create unique index on lowercase word
-- This prevents future duplicates while allowing the constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_items_word_lower 
ON items(LOWER(word));

-- Note: If this fails due to existing duplicates, you must:
-- 1. Identify duplicates using the query above
-- 2. Manually merge or delete duplicate items
-- 3. Re-run this migration

-- Step 3: Verify the constraint works
-- Try inserting a duplicate (should fail):
-- INSERT INTO items (item_id, word, type) VALUES (999999, 'Poetry', 'Reference');
-- This should return: UNIQUE constraint failed: items.word

-- Rollback (if needed):
-- DROP INDEX IF EXISTS idx_items_word_lower;
