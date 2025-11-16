# Story 10.2: Database Migration Instructions

## Migration Required: Add `has_consent_mode` Column

### Step 1: Run SQL Migration in Supabase Dashboard

1. Open your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Create a new query
4. Copy and paste the SQL below:

```sql
-- Migration: Add consent_mode support to properties table
-- Story: 10.2 - Consent Mode Support
-- Date: 2025-01-06

-- Add has_consent_mode column with default false for existing records
ALTER TABLE properties
ADD COLUMN has_consent_mode BOOLEAN DEFAULT false NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN properties.has_consent_mode IS
'Indicates if property uses Google Consent Mode. When true, page_view absence is not flagged as error.';

-- Create index for efficient filtering
CREATE INDEX idx_properties_consent_mode ON properties(has_consent_mode);
```

5. Click **Run** to execute the migration

### Step 2: Verify Migration

After running the migration, verify it was successful:

```sql
-- Verify column exists
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'properties' AND column_name = 'has_consent_mode';

-- Check existing data (all should be false initially)
SELECT COUNT(*), has_consent_mode
FROM properties
GROUP BY has_consent_mode;
```

Expected output:
- Column `has_consent_mode` exists with type `boolean` and default `false`
- All existing properties have `has_consent_mode = false`

### Step 3: Run Verification Script

From your project root, run:

```bash
node src/migrations/verify-consent-mode-migration.js
```

This will confirm the migration was successful and the column is accessible via the API.

---

## Migration Files Created

- `src/migrations/add_consent_mode_column.sql` - SQL migration script
- `src/migrations/run-consent-mode-migration.js` - Node.js migration runner (provides instructions)
- `src/migrations/verify-consent-mode-migration.js` - Verification script

---

## Rollback (if needed)

If you need to rollback this migration:

```sql
-- Remove index
DROP INDEX IF EXISTS idx_properties_consent_mode;

-- Remove column
ALTER TABLE properties
DROP COLUMN IF EXISTS has_consent_mode;
```

**Note**: This is safe to run as the column was just added and contains only default values.
