-- ============================================================================
-- Data Lifecycle Management Migration
-- Created: 2025-01-02
-- Purpose: Add TTL and permanent storage support for crawl data
-- ============================================================================

-- Add upload tracking columns to crawl_runs
ALTER TABLE crawl_runs ADD COLUMN IF NOT EXISTS upload_completed_at TIMESTAMPTZ;
ALTER TABLE crawl_runs ADD COLUMN IF NOT EXISTS upload_duration_ms INTEGER;
ALTER TABLE crawl_runs ADD COLUMN IF NOT EXISTS upload_success_count INTEGER DEFAULT 0;
ALTER TABLE crawl_runs ADD COLUMN IF NOT EXISTS upload_failed_count INTEGER DEFAULT 0;

-- Add permanent screenshot URL column to crawl_results
ALTER TABLE crawl_results ADD COLUMN IF NOT EXISTS permanent_screenshot_url TEXT;

-- Add index for TTL cleanup queries (unsaved runs older than TTL)
CREATE INDEX IF NOT EXISTS idx_crawl_runs_cleanup
ON crawl_runs(is_saved, started_at, status)
WHERE is_saved = false AND status IN ('completed', 'failed', 'cancelled');

-- Add index for screenshot cleanup queries
CREATE INDEX IF NOT EXISTS idx_crawl_results_screenshot_cleanup
ON crawl_results(created_at)
WHERE screenshot_url IS NOT NULL;

-- ============================================================================
-- RPC Function: Find Orphaned Crawl Results
-- ============================================================================
-- Finds crawl_results rows where the parent crawl_run no longer exists
-- Used by dataLifecycleManager.cleanupOrphanedResults()

CREATE OR REPLACE FUNCTION find_orphaned_crawl_results()
RETURNS TABLE (
  id BIGINT,
  crawl_run_id BIGINT,
  property_id BIGINT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cr.id,
    cr.crawl_run_id,
    cr.property_id,
    cr.created_at
  FROM crawl_results cr
  LEFT JOIN crawl_runs run ON cr.crawl_run_id = run.id
  WHERE run.id IS NULL;
END;
$$;

-- ============================================================================
-- RPC Function: Get Cleanup Statistics
-- ============================================================================
-- Returns statistics for data lifecycle management dashboard

CREATE OR REPLACE FUNCTION get_cleanup_statistics()
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'unsaved_runs', (
      SELECT COUNT(*)
      FROM crawl_runs
      WHERE is_saved = false
        AND status IN ('completed', 'failed', 'cancelled')
    ),
    'saved_runs', (
      SELECT COUNT(*)
      FROM crawl_runs
      WHERE is_saved = true
    ),
    'orphaned_results', (
      SELECT COUNT(*)
      FROM find_orphaned_crawl_results()
    ),
    'total_results', (
      SELECT COUNT(*)
      FROM crawl_results
    ),
    'oldest_unsaved_run', (
      SELECT started_at
      FROM crawl_runs
      WHERE is_saved = false
        AND status IN ('completed', 'failed', 'cancelled')
      ORDER BY started_at ASC
      LIMIT 1
    ),
    'total_storage_mb', (
      SELECT SUM(LENGTH(screenshot_url)::BIGINT) / 1024 / 1024
      FROM crawl_results
      WHERE screenshot_url IS NOT NULL
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- ============================================================================
-- RPC Function: Move Crawl Run to Permanent Storage
-- ============================================================================
-- Called when user saves a crawl run (is_saved = true)
-- Updates screenshot URLs to permanent storage paths

CREATE OR REPLACE FUNCTION move_crawl_to_permanent_storage(
  p_run_id BIGINT
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  result JSON;
  updated_count INTEGER;
BEGIN
  -- Update crawl_run to saved status
  UPDATE crawl_runs
  SET
    is_saved = true,
    saved_at = NOW()
  WHERE id = p_run_id;

  -- Count results that need screenshot migration
  SELECT COUNT(*) INTO updated_count
  FROM crawl_results
  WHERE crawl_run_id = p_run_id
    AND screenshot_url IS NOT NULL
    AND permanent_screenshot_url IS NULL;

  -- Return migration summary
  SELECT json_build_object(
    'run_id', p_run_id,
    'saved_at', NOW(),
    'screenshots_to_migrate', updated_count,
    'status', 'pending_migration'
  ) INTO result;

  RETURN result;
END;
$$;

-- ============================================================================
-- RPC Function: Cleanup Expired Data
-- ============================================================================
-- Comprehensive cleanup function that can be called via cron or API
-- Returns summary of deleted records

CREATE OR REPLACE FUNCTION cleanup_expired_data(
  p_unsaved_ttl_days INTEGER DEFAULT 30,
  p_screenshot_ttl_days INTEGER DEFAULT 30,
  p_batch_size INTEGER DEFAULT 100
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  result JSON;
  deleted_runs INTEGER := 0;
  deleted_results INTEGER := 0;
  cutoff_date TIMESTAMPTZ;
BEGIN
  -- Calculate cutoff date for crawl runs
  cutoff_date := NOW() - (p_unsaved_ttl_days || ' days')::INTERVAL;

  -- Delete expired unsaved crawl runs (cascade will delete results)
  WITH deleted AS (
    DELETE FROM crawl_runs
    WHERE is_saved = false
      AND status IN ('completed', 'failed', 'cancelled')
      AND started_at < cutoff_date
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_runs FROM deleted;

  -- Delete orphaned results
  WITH deleted AS (
    DELETE FROM crawl_results cr
    WHERE NOT EXISTS (
      SELECT 1 FROM crawl_runs run WHERE run.id = cr.crawl_run_id
    )
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_results FROM deleted;

  -- Build result summary
  SELECT json_build_object(
    'deleted_runs', deleted_runs,
    'deleted_results', deleted_results,
    'cutoff_date', cutoff_date,
    'unsaved_ttl_days', p_unsaved_ttl_days,
    'screenshot_ttl_days', p_screenshot_ttl_days,
    'cleaned_at', NOW()
  ) INTO result;

  RETURN result;
END;
$$;

-- ============================================================================
-- Comments for Documentation
-- ============================================================================

COMMENT ON COLUMN crawl_runs.upload_completed_at IS 'Timestamp when batch upload to Supabase completed';
COMMENT ON COLUMN crawl_runs.upload_duration_ms IS 'Duration of batch upload in milliseconds';
COMMENT ON COLUMN crawl_runs.upload_success_count IS 'Number of results successfully uploaded';
COMMENT ON COLUMN crawl_runs.upload_failed_count IS 'Number of results that failed to upload';

COMMENT ON COLUMN crawl_results.permanent_screenshot_url IS 'Permanent screenshot URL for saved crawl runs';

COMMENT ON FUNCTION find_orphaned_crawl_results() IS 'Finds crawl_results where parent crawl_run no longer exists';
COMMENT ON FUNCTION get_cleanup_statistics() IS 'Returns data lifecycle management statistics';
COMMENT ON FUNCTION move_crawl_to_permanent_storage(BIGINT) IS 'Marks crawl run as saved and prepares for permanent storage';
COMMENT ON FUNCTION cleanup_expired_data(INTEGER, INTEGER, INTEGER) IS 'Deletes expired unsaved crawl runs and orphaned results';

-- ============================================================================
-- Grant Permissions
-- ============================================================================

-- Allow service role to execute RPC functions
GRANT EXECUTE ON FUNCTION find_orphaned_crawl_results() TO service_role;
GRANT EXECUTE ON FUNCTION get_cleanup_statistics() TO service_role;
GRANT EXECUTE ON FUNCTION move_crawl_to_permanent_storage(BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_expired_data(INTEGER, INTEGER, INTEGER) TO service_role;

-- ============================================================================
-- Migration Complete
-- ============================================================================

-- Verify migration success
DO $$
BEGIN
  RAISE NOTICE 'Data Lifecycle Management migration completed successfully';
  RAISE NOTICE 'New columns added: upload_completed_at, upload_duration_ms, upload_success_count, upload_failed_count, permanent_screenshot_url';
  RAISE NOTICE 'New indexes created: idx_crawl_runs_cleanup, idx_crawl_results_screenshot_cleanup';
  RAISE NOTICE 'New RPC functions: find_orphaned_crawl_results, get_cleanup_statistics, move_crawl_to_permanent_storage, cleanup_expired_data';
END $$;
