-- GA4 Tech Issue Catcher - Initial Database Schema
-- Migration: 001_initial_schema
-- Created: 2025-01-31

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- Table: properties
-- Purpose: Store all GA4 properties to be crawled
-- ============================================================================
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Property identification
  property_name TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE, -- URL-safe identifier

  -- Expected configurations
  expected_ga4_id TEXT,
  expected_gtm_id TEXT,

  -- Current status
  current_status TEXT NOT NULL DEFAULT 'normal' CHECK (current_status IN ('normal', 'issue', 'debugging')),

  -- Metadata
  brand TEXT,
  region TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for properties
CREATE INDEX idx_properties_status ON properties(current_status);
CREATE INDEX idx_properties_active ON properties(is_active);
CREATE INDEX idx_properties_slug ON properties(slug);
CREATE INDEX idx_properties_url ON properties(url);

-- ============================================================================
-- Table: crawl_runs
-- Purpose: Track each crawl execution
-- ============================================================================
CREATE TABLE crawl_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Run identification
  run_date DATE NOT NULL,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),

  -- Statistics
  total_properties INTEGER NOT NULL DEFAULT 0,
  completed_properties INTEGER NOT NULL DEFAULT 0,
  failed_properties INTEGER NOT NULL DEFAULT 0,
  properties_with_issues INTEGER NOT NULL DEFAULT 0,

  -- Configuration
  browser_pool_size INTEGER NOT NULL DEFAULT 7,

  -- Timing
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_seconds INTEGER,

  -- Error tracking
  error_message TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for crawl_runs
CREATE INDEX idx_crawl_runs_date ON crawl_runs(run_date DESC);
CREATE INDEX idx_crawl_runs_status ON crawl_runs(status);
CREATE INDEX idx_crawl_runs_started ON crawl_runs(started_at DESC);

-- ============================================================================
-- Table: crawl_results
-- Purpose: Store individual property crawl results
-- ============================================================================
CREATE TABLE crawl_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Foreign keys
  crawl_run_id UUID NOT NULL REFERENCES crawl_runs(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,

  -- Validation status
  validation_status TEXT NOT NULL CHECK (validation_status IN ('passed', 'failed', 'error')),

  -- Collected data
  collected_ga4_id TEXT,
  collected_gtm_id TEXT,
  page_view_event_detected BOOLEAN NOT NULL DEFAULT false,

  -- Issue tracking
  has_issues BOOLEAN NOT NULL DEFAULT false,
  issue_types TEXT[], -- Array of issue types: 'ga4_mismatch', 'gtm_mismatch', 'no_page_view', etc.
  issue_summary TEXT,

  -- Screenshots
  screenshot_path TEXT,
  screenshot_url TEXT,

  -- Timing
  validation_duration_ms INTEGER,
  phase INTEGER, -- Which phase (1 or 2)

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for crawl_results
CREATE INDEX idx_crawl_results_run ON crawl_results(crawl_run_id);
CREATE INDEX idx_crawl_results_property ON crawl_results(property_id);
CREATE INDEX idx_crawl_results_status ON crawl_results(validation_status);
CREATE INDEX idx_crawl_results_issues ON crawl_results(has_issues);
CREATE INDEX idx_crawl_results_created ON crawl_results(created_at DESC);

-- Composite index for common queries
CREATE INDEX idx_crawl_results_run_property ON crawl_results(crawl_run_id, property_id);

-- ============================================================================
-- Table: property_status_history
-- Purpose: Track all status changes for properties with full audit trail
-- ============================================================================
CREATE TABLE property_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Foreign key
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,

  -- Status change
  previous_status TEXT NOT NULL CHECK (previous_status IN ('normal', 'issue', 'debugging')),
  new_status TEXT NOT NULL CHECK (new_status IN ('normal', 'issue', 'debugging')),

  -- Change context
  change_reason TEXT, -- e.g., "Manual update", "Automated detection", "Issue resolved"
  changed_by TEXT, -- e.g., "system", "admin", "crawler"

  -- Related crawl (if status changed due to crawl)
  related_crawl_run_id UUID REFERENCES crawl_runs(id) ON DELETE SET NULL,

  -- Additional notes
  notes TEXT,

  -- Timestamp
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for property_status_history
CREATE INDEX idx_status_history_property ON property_status_history(property_id);
CREATE INDEX idx_status_history_changed ON property_status_history(changed_at DESC);
CREATE INDEX idx_status_history_new_status ON property_status_history(new_status);

-- Composite index for property timeline queries
CREATE INDEX idx_status_history_property_time ON property_status_history(property_id, changed_at DESC);

-- ============================================================================
-- Functions and Triggers
-- ============================================================================

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-update updated_at for properties
CREATE TRIGGER update_properties_updated_at
  BEFORE UPDATE ON properties
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger: Auto-update updated_at for crawl_runs
CREATE TRIGGER update_crawl_runs_updated_at
  BEFORE UPDATE ON crawl_runs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function: Track property status changes
CREATE OR REPLACE FUNCTION track_property_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only track if status actually changed
  IF OLD.current_status IS DISTINCT FROM NEW.current_status THEN
    INSERT INTO property_status_history (
      property_id,
      previous_status,
      new_status,
      change_reason,
      changed_by
    ) VALUES (
      NEW.id,
      OLD.current_status,
      NEW.current_status,
      'Status updated',
      'system'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-track property status changes
CREATE TRIGGER track_properties_status_change
  AFTER UPDATE ON properties
  FOR EACH ROW
  EXECUTE FUNCTION track_property_status_change();

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE crawl_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE crawl_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_status_history ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users (can be refined later)
CREATE POLICY "Allow all for authenticated users" ON properties
  FOR ALL USING (true);

CREATE POLICY "Allow all for authenticated users" ON crawl_runs
  FOR ALL USING (true);

CREATE POLICY "Allow all for authenticated users" ON crawl_results
  FOR ALL USING (true);

CREATE POLICY "Allow all for authenticated users" ON property_status_history
  FOR ALL USING (true);

-- ============================================================================
-- Seed Data (Optional - can be populated from CSV)
-- ============================================================================

-- This will be populated from the existing CSV file via API
COMMENT ON TABLE properties IS 'GA4 properties to be monitored and crawled';
COMMENT ON TABLE crawl_runs IS 'History of all crawl executions';
COMMENT ON TABLE crawl_results IS 'Individual results for each property in each crawl';
COMMENT ON TABLE property_status_history IS 'Audit trail of all property status changes';
