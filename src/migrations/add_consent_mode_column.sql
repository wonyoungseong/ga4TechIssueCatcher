-- Migration: Add consent_mode support to properties table
-- Story: 10.2 - Consent Mode Support
-- Date: 2025-01-06
-- Description: Add has_consent_mode column to track properties using Google Consent Mode

-- Add has_consent_mode column with default false for existing records
ALTER TABLE properties
ADD COLUMN has_consent_mode BOOLEAN DEFAULT false NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN properties.has_consent_mode IS
'Indicates if property uses Google Consent Mode. When true, page_view absence is not flagged as error.';

-- Create index for efficient filtering
CREATE INDEX idx_properties_consent_mode ON properties(has_consent_mode);

-- Verification queries (commented out - run separately to verify)
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'properties' AND column_name = 'has_consent_mode';

-- SELECT COUNT(*), has_consent_mode
-- FROM properties
-- GROUP BY has_consent_mode;
