-- Migration: Add composite covering indexes for link queries
-- Created: December 14, 2025
-- Purpose: Optimize GetItemLinks queries by including all columns in index to avoid table lookups

-- Add covering indexes for GetItemLinks query
-- These include link_type and created_at so SQLite can satisfy queries entirely from the index
CREATE INDEX IF NOT EXISTS idx_links_source_covering 
ON links(source_item_id, created_at DESC, destination_item_id, link_type);

CREATE INDEX IF NOT EXISTS idx_links_destination_covering 
ON links(destination_item_id, created_at DESC, source_item_id, link_type);

-- The existing simple indexes can remain for backward compatibility and simpler queries:
-- idx_links_source on links(source_item_id)
-- idx_links_destination on links(destination_item_id)

-- Performance test queries:
-- Before: Uses idx_links_source + table lookup
-- After: Uses idx_links_source_covering (no table lookup needed)
-- 
-- EXPLAIN QUERY PLAN 
-- SELECT link_id, source_item_id, destination_item_id, link_type, created_at
-- FROM links WHERE source_item_id = ? ORDER BY created_at DESC;

-- Rollback instructions:
-- DROP INDEX IF EXISTS idx_links_source_covering;
-- DROP INDEX IF EXISTS idx_links_destination_covering;
