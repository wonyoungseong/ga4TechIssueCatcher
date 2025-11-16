-- Migration: 002_add_saved_runs_fields
-- Purpose: Add fields to support saving crawl runs with memos
-- Created: 2025-02-01

-- Add is_saved and memo fields to crawl_runs table
ALTER TABLE crawl_runs
  ADD COLUMN is_saved BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN memo TEXT,
  ADD COLUMN saved_at TIMESTAMPTZ;

-- Create index for saved runs queries
CREATE INDEX idx_crawl_runs_saved ON crawl_runs(is_saved, saved_at DESC);

-- Add comment
COMMENT ON COLUMN crawl_runs.is_saved IS 'Whether this crawl run has been saved by user';
COMMENT ON COLUMN crawl_runs.memo IS 'User memo/notes for this saved crawl run';
COMMENT ON COLUMN crawl_runs.saved_at IS 'Timestamp when the crawl run was saved';
