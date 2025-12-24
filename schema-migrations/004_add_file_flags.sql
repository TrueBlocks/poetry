-- Migration: Add file existence flags to items table
-- Date: 2025-12-23
-- Issue: #43 - Fix N+1 File I/O Performance Bottleneck in Search
-- Purpose: Track image and TTS file existence in database to eliminate filesystem checks during search

-- Add columns for file existence tracking
ALTER TABLE items ADD COLUMN has_image INTEGER DEFAULT 0;
ALTER TABLE items ADD COLUMN has_tts INTEGER DEFAULT 0;

-- Create indexes for efficient filtering
CREATE INDEX IF NOT EXISTS idx_items_has_image ON items(has_image);
CREATE INDEX IF NOT EXISTS idx_items_has_tts ON items(has_tts);

-- Note: After running this migration, run the SyncFileFlags() function
-- to populate flags based on existing files in data/images/ and data/tts-cache/

-- Rollback (if needed):
-- DROP INDEX IF EXISTS idx_items_has_image;
-- DROP INDEX IF EXISTS idx_items_has_tts;
-- ALTER TABLE items DROP COLUMN has_image;
-- ALTER TABLE items DROP COLUMN has_tts;
