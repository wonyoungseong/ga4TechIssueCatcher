-- Migration: 007 - Crawl Request Queue
-- Purpose: Enable queue-based crawl execution for Render environment
-- Description: Render adds requests to queue, local worker processes them
-- Created: 2025-11-21

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create crawl_request_queue table
CREATE TABLE IF NOT EXISTS crawl_request_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Request metadata
  requested_by TEXT NOT NULL DEFAULT 'unknown', -- "render", "local", "manual"
  request_source TEXT, -- IP address or hostname

  -- Crawl configuration
  browser_pool_size INTEGER DEFAULT 7 CHECK (browser_pool_size >= 1 AND browser_pool_size <= 15),
  property_ids UUID[], -- NULL = all active properties

  -- Queue status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),

  -- Processing info
  assigned_worker TEXT, -- Hostname/ID of worker processing this request
  started_processing_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Associated crawl run (once started)
  crawl_run_id UUID REFERENCES crawl_runs(id) ON DELETE SET NULL,

  -- Error tracking
  error_message TEXT,
  retry_count INTEGER DEFAULT 0 CHECK (retry_count >= 0),
  max_retries INTEGER DEFAULT 3 CHECK (max_retries >= 0),

  -- Timing
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Priority (future enhancement)
  priority INTEGER DEFAULT 0 CHECK (priority >= 0),

  -- Constraints
  CONSTRAINT valid_processing_state CHECK (
    (status = 'processing' AND assigned_worker IS NOT NULL AND started_processing_at IS NOT NULL) OR
    (status != 'processing')
  ),
  CONSTRAINT valid_completion_state CHECK (
    (status IN ('completed', 'failed', 'cancelled') AND completed_at IS NOT NULL) OR
    (status NOT IN ('completed', 'failed', 'cancelled'))
  )
);

-- Create indexes for efficient queue polling
CREATE INDEX IF NOT EXISTS idx_crawl_queue_status
  ON crawl_request_queue(status);

CREATE INDEX IF NOT EXISTS idx_crawl_queue_pending
  ON crawl_request_queue(status, created_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_crawl_queue_processing
  ON crawl_request_queue(status, assigned_worker, started_processing_at)
  WHERE status = 'processing';

CREATE INDEX IF NOT EXISTS idx_crawl_queue_created
  ON crawl_request_queue(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_crawl_queue_crawl_run
  ON crawl_request_queue(crawl_run_id)
  WHERE crawl_run_id IS NOT NULL;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_crawl_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_crawl_queue_timestamp
  BEFORE UPDATE ON crawl_request_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_crawl_queue_updated_at();

-- Add comments for documentation
COMMENT ON TABLE crawl_request_queue IS 'Queue for crawl execution requests from Render environment';
COMMENT ON COLUMN crawl_request_queue.requested_by IS 'Source of the request: render, local, manual';
COMMENT ON COLUMN crawl_request_queue.status IS 'Queue item status: pending, processing, completed, failed, cancelled';
COMMENT ON COLUMN crawl_request_queue.assigned_worker IS 'Worker ID/hostname processing this request';
COMMENT ON COLUMN crawl_request_queue.crawl_run_id IS 'Associated crawl_run once execution starts';
COMMENT ON COLUMN crawl_request_queue.priority IS 'Higher priority items are processed first (future feature)';

-- Enable Row Level Security (RLS)
ALTER TABLE crawl_request_queue ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Enable read access for authenticated users" ON crawl_request_queue
  FOR SELECT
  USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

CREATE POLICY "Enable insert for authenticated users" ON crawl_request_queue
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'anon');

CREATE POLICY "Enable update for authenticated users" ON crawl_request_queue
  FOR UPDATE
  USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- Grant permissions
GRANT ALL ON crawl_request_queue TO postgres, anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated;
