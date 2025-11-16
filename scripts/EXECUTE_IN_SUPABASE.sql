-- ============================================================================
-- GTM Column Migration: TEXT to TEXT[] (Array)
-- ============================================================================
-- Purpose: Change collected_gtm_id column to support multiple GTM IDs
-- Execution: Copy and paste this entire SQL into Supabase SQL Editor
-- ============================================================================

-- Step 1: Alter the column type to TEXT[]
ALTER TABLE crawl_results
ALTER COLUMN collected_gtm_id TYPE TEXT[]
USING CASE
  -- If the current value is not null/empty, convert it to an array with single element
  WHEN collected_gtm_id IS NOT NULL AND collected_gtm_id != '' THEN ARRAY[collected_gtm_id]::TEXT[]
  -- Otherwise, use an empty array
  ELSE '{}'::TEXT[]
END;

-- Step 2: Set default value for new records
ALTER TABLE crawl_results
ALTER COLUMN collected_gtm_id SET DEFAULT '{}';

-- Step 3: Verify the migration
SELECT
  id,
  property_id,
  collected_gtm_id,
  array_length(collected_gtm_id, 1) as gtm_count
FROM crawl_results
WHERE collected_gtm_id IS NOT NULL AND collected_gtm_id != '{}'
LIMIT 10;

-- ============================================================================
-- Expected Result:
-- - All existing single GTM IDs converted to arrays: ['GTM-XXXX']
-- - Empty or null values converted to empty arrays: []
-- - Future crawls will store multiple GTM IDs: ['GTM-XXXX', 'GTM-YYYY']
-- ============================================================================
