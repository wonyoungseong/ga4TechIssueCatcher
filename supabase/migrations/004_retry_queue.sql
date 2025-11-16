-- Migration: Add retry_queue table for network error retry system
-- Story: 10.3 - Network Error Retry Queue System
-- Created: 2025-11-07

-- Create retry_queue table
CREATE TABLE retry_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  crawl_run_id UUID NOT NULL REFERENCES crawl_runs(id) ON DELETE CASCADE,
  failure_reason TEXT,
  failure_count INTEGER NOT NULL DEFAULT 1,
  last_attempt_at TIMESTAMP,
  next_retry_at TIMESTAMP NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'retrying', 'resolved', 'permanent_failure')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient query performance
CREATE INDEX idx_retry_queue_status ON retry_queue(status);
CREATE INDEX idx_retry_queue_next_retry ON retry_queue(next_retry_at);
CREATE INDEX idx_retry_queue_property ON retry_queue(property_id);
CREATE INDEX idx_retry_queue_status_next_retry ON retry_queue(status, next_retry_at);

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_retry_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_retry_queue_updated_at
  BEFORE UPDATE ON retry_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_retry_queue_updated_at();

-- Add comment to table
COMMENT ON TABLE retry_queue IS 'Queue for retrying failed property validations due to transient network issues';
COMMENT ON COLUMN retry_queue.property_id IS 'Reference to the property that failed validation';
COMMENT ON COLUMN retry_queue.crawl_run_id IS 'Reference to the crawl run where the failure occurred';
COMMENT ON COLUMN retry_queue.failure_reason IS 'Description of why the validation failed';
COMMENT ON COLUMN retry_queue.failure_count IS 'Number of retry attempts (max 3)';
COMMENT ON COLUMN retry_queue.last_attempt_at IS 'Timestamp of the most recent retry attempt';
COMMENT ON COLUMN retry_queue.next_retry_at IS 'Scheduled time for next retry (exponential backoff: 30min, 1hr, 2hr)';
COMMENT ON COLUMN retry_queue.status IS 'Current status: pending, retrying, resolved, or permanent_failure';
