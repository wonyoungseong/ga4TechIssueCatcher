-- ============================================================================
-- Screenshots Table Migration
-- Created: 2024-11-14
-- Purpose: Store screenshot metadata and file references
-- ============================================================================

-- Create screenshots table
CREATE TABLE IF NOT EXISTS screenshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Foreign keys
  crawl_run_id UUID NOT NULL REFERENCES crawl_runs(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,

  -- File information
  file_path TEXT NOT NULL, -- Local file path or Storage bucket path
  file_name TEXT NOT NULL, -- Original filename
  file_size BIGINT, -- File size in bytes
  mime_type TEXT DEFAULT 'image/png' CHECK (mime_type IN ('image/jpeg', 'image/jpg', 'image/png')),

  -- Storage bucket reference
  bucket_path TEXT, -- Path in Supabase Storage (e.g., 'screenshots/2024-11-14/property-slug.png')
  storage_url TEXT, -- Public URL if available

  -- Screenshot metadata
  screenshot_type TEXT DEFAULT 'full_page' CHECK (screenshot_type IN ('full_page', 'viewport', 'element')),
  viewport_width INTEGER,
  viewport_height INTEGER,

  -- Error context (if screenshot was taken during error)
  error_context TEXT,
  validation_status TEXT, -- Status at time of screenshot

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX idx_screenshots_run ON screenshots(crawl_run_id);
CREATE INDEX idx_screenshots_property ON screenshots(property_id);
CREATE INDEX idx_screenshots_created ON screenshots(created_at DESC);
CREATE INDEX idx_screenshots_type ON screenshots(screenshot_type);

-- Composite index for common queries
CREATE INDEX idx_screenshots_run_property ON screenshots(crawl_run_id, property_id);

-- Create trigger for auto-updating updated_at
CREATE TRIGGER update_screenshots_updated_at
  BEFORE UPDATE ON screenshots
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add RLS policy
ALTER TABLE screenshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" ON screenshots
  FOR ALL USING (true);

-- Grant permissions
GRANT ALL ON TABLE screenshots TO service_role;
GRANT ALL ON TABLE screenshots TO authenticated;

-- Add comments
COMMENT ON TABLE screenshots IS 'Screenshot metadata and storage references for property validations';
COMMENT ON COLUMN screenshots.file_path IS 'Local or storage file path';
COMMENT ON COLUMN screenshots.bucket_path IS 'Path within Supabase Storage bucket';
COMMENT ON COLUMN screenshots.storage_url IS 'Public URL for accessing screenshot';
COMMENT ON COLUMN screenshots.screenshot_type IS 'Type of screenshot captured';
COMMENT ON COLUMN screenshots.error_context IS 'Error information if screenshot was taken during failure';

-- ============================================================================
-- Migration Complete
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Screenshots table migration completed successfully';
  RAISE NOTICE 'New table: screenshots with support for Supabase Storage integration';
END $$;
