-- Migration 006: Add missing columns for local Supabase
-- Created: 2024-11-14
-- Purpose: Add columns that were missing in local schema

-- Add has_consent_mode column to properties table
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS has_consent_mode BOOLEAN DEFAULT NULL;

-- Add validation_details column to crawl_results table
ALTER TABLE crawl_results
ADD COLUMN IF NOT EXISTS validation_details JSONB DEFAULT NULL;

-- Create crawler_settings table if not exists
CREATE TABLE IF NOT EXISTS crawler_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default crawler timeout settings
INSERT INTO crawler_settings (setting_key, setting_value, description)
VALUES
  ('phase1_timeout_ms', '20000', 'Phase 1 validation timeout in milliseconds'),
  ('phase2_timeout_ms', '60000', 'Phase 2 validation timeout in milliseconds')
ON CONFLICT (setting_key) DO NOTHING;

-- Add comment
COMMENT ON TABLE crawler_settings IS 'Store crawler configuration settings';
COMMENT ON COLUMN properties.has_consent_mode IS 'Indicates if the property has Google Consent Mode v2 detected';
COMMENT ON COLUMN crawl_results.validation_details IS 'Detailed validation information in JSON format';
