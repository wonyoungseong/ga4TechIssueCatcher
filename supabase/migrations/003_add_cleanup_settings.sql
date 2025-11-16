-- ============================================================================
-- Cleanup Settings Migration
-- Created: 2025-11-03
-- Purpose: Move cleanup schedule from .env to database storage
-- ============================================================================

-- Create cleanup_settings table
CREATE TABLE IF NOT EXISTS cleanup_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Schedule configuration
  cron_expression TEXT NOT NULL DEFAULT '0 3 * * *', -- Default: 3 AM daily (Asia/Seoul)
  timezone TEXT NOT NULL DEFAULT 'Asia/Seoul',
  is_enabled BOOLEAN NOT NULL DEFAULT true,

  -- Cleanup configuration
  unsaved_crawl_ttl_days INTEGER NOT NULL DEFAULT 30,
  screenshot_ttl_days INTEGER NOT NULL DEFAULT 30,
  batch_size INTEGER NOT NULL DEFAULT 100,

  -- Metadata
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create trigger for auto-updating updated_at
CREATE TRIGGER update_cleanup_settings_updated_at
  BEFORE UPDATE ON cleanup_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default settings (will be used if .env CLEANUP_CRON doesn't exist)
INSERT INTO cleanup_settings (
  cron_expression,
  timezone,
  is_enabled,
  unsaved_crawl_ttl_days,
  screenshot_ttl_days,
  batch_size
) VALUES (
  '0 3 * * *',
  'Asia/Seoul',
  true,
  30,
  30,
  100
) ON CONFLICT DO NOTHING;

-- Add RLS policy
ALTER TABLE cleanup_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" ON cleanup_settings
  FOR ALL USING (true);

-- Grant permissions
GRANT ALL ON TABLE cleanup_settings TO service_role;
GRANT ALL ON TABLE cleanup_settings TO authenticated;

-- Add comments
COMMENT ON TABLE cleanup_settings IS 'Cleanup scheduler configuration and settings';
COMMENT ON COLUMN cleanup_settings.cron_expression IS 'Cron expression for cleanup schedule (e.g., 0 3 * * * for 3 AM daily)';
COMMENT ON COLUMN cleanup_settings.timezone IS 'Timezone for cron schedule (default: Asia/Seoul)';
COMMENT ON COLUMN cleanup_settings.is_enabled IS 'Whether automatic cleanup is enabled';
COMMENT ON COLUMN cleanup_settings.unsaved_crawl_ttl_days IS 'Days to keep unsaved crawl runs before deletion';
COMMENT ON COLUMN cleanup_settings.screenshot_ttl_days IS 'Days to keep screenshots in temporary storage';
COMMENT ON COLUMN cleanup_settings.batch_size IS 'Batch size for cleanup operations';
COMMENT ON COLUMN cleanup_settings.last_run_at IS 'Timestamp of last cleanup execution';
COMMENT ON COLUMN cleanup_settings.next_run_at IS 'Timestamp of next scheduled cleanup';

-- ============================================================================
-- Migration Complete
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Cleanup Settings migration completed successfully';
  RAISE NOTICE 'New table: cleanup_settings with default schedule 0 3 * * * (3 AM daily, Asia/Seoul)';
  RAISE NOTICE 'Legacy .env CLEANUP_CRON can now be removed';
END $$;
