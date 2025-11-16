# Local Database Migration Guide

Complete guide for migrating the GA4 Tech Issue Catcher database to local Supabase.

## Overview

This guide covers:
1. Automatic migration setup via Docker
2. Storage bucket configuration
3. Properties data import
4. Migration verification

## Prerequisites

- Docker Desktop running
- Local Supabase stack started (see SUPABASE_LOCAL_SETUP.md)
- Node.js and npm installed

## Migration Files

All migration files are located in `supabase/migrations/` and will be automatically applied when the database container starts:

### Existing Migrations

1. **001_initial_schema.sql** - Core tables and schema
   - `properties` - GA4 properties to monitor
   - `crawl_runs` - Crawl execution history
   - `crawl_results` - Individual validation results
   - `property_status_history` - Status change audit trail

2. **002_add_saved_runs_fields.sql** - Saved runs functionality

3. **003_add_cleanup_settings.sql** - Cleanup scheduler configuration

4. **004_retry_queue.sql** - Network error retry system

5. **005_add_screenshots_table.sql** - Screenshot metadata storage

### Migration Execution

Migrations are automatically executed in alphanumeric order when:
- Database container starts for the first time
- Database volume is recreated

The migrations folder is mounted as Docker init scripts:
```yaml
volumes:
  - ./supabase/migrations:/docker-entrypoint-initdb.d:ro
```

## Step-by-Step Migration

### 1. Start Local Supabase

```bash
# Ensure Docker Desktop is running
docker-compose --env-file .env.local up -d

# Wait for all services to be healthy
docker-compose ps
```

All migrations will be automatically applied during database initialization.

### 2. Verify Migrations

```bash
# Run verification script
node scripts/verify-migration.js
```

Expected output:
```
✅ All checks passed!
✅ Database schema is correctly migrated
✅ All tables, constraints, and RLS policies are in place
```

### 3. Setup Storage Bucket

```bash
# Create 'screenshots' bucket
node scripts/setup-storage.js
```

This creates a public bucket with:
- Name: `screenshots`
- Allowed types: image/jpeg, image/jpg, image/png
- Size limit: 10MB
- Public access: enabled

### 4. Import Properties Data

```bash
# Import from default CSV
node scripts/import-properties-to-local.js

# Or specify custom CSV path
node scripts/import-properties-to-local.js ./path/to/custom.csv
```

Expected output:
```
✅ Import completed!
   Inserted: 106
   Skipped (duplicates): 0
   Errors: 0
   Total in Database: 106
```

## Verification Commands

### Check Database Tables

```bash
# List all tables
docker exec supabase-db psql -U postgres -c "\\dt"

# Check properties count
docker exec supabase-db psql -U postgres -c "SELECT COUNT(*) FROM properties WHERE is_active = true;"

# View table structure
docker exec supabase-db psql -U postgres -c "\\d+ properties"
```

### Check Storage Bucket

```bash
# Access Supabase Studio
open http://localhost:3001

# Navigate to Storage section
# Verify 'screenshots' bucket exists
```

### Test Data Operations

```bash
# Run verification script
node scripts/verify-migration.js
```

## Database Schema Summary

### Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `properties` | GA4 properties | id, property_name, url, expected_ga4_id, expected_gtm_id |
| `crawl_runs` | Crawl executions | id, run_date, status, total_properties |
| `crawl_results` | Validation results | id, crawl_run_id, property_id, validation_status |
| `screenshots` | Screenshot metadata | id, crawl_run_id, property_id, bucket_path, storage_url |
| `property_status_history` | Status changes | id, property_id, previous_status, new_status |
| `retry_queue` | Failed validations | id, property_id, failure_reason, status |
| `cleanup_settings` | Cleanup config | id, cron_expression, is_enabled |

### Indexes

All tables have appropriate indexes for:
- Primary keys (UUID)
- Foreign key relationships
- Common query patterns (status, dates, active flags)
- Composite queries (run + property lookups)

### Row Level Security (RLS)

All tables have RLS enabled with policies allowing:
- Full access for authenticated users
- Service role has unrestricted access

## Troubleshooting

### Migrations Not Applied

**Symptom**: Tables don't exist after starting database

**Solution**:
```bash
# Check if migrations folder is mounted
docker-compose config | grep migrations

# Check database logs
docker-compose logs db | grep -i migration

# Recreate database with fresh migrations
docker-compose down -v
docker-compose --env-file .env.local up -d
```

### Storage Bucket Creation Fails

**Symptom**: `setup-storage.js` fails with connection error

**Solution**:
```bash
# Verify Storage API is running
docker-compose ps storage

# Check Storage API logs
docker-compose logs storage

# Test Storage API endpoint
curl http://localhost:5000/storage/v1/version

# Verify environment variables
grep SERVICE_KEY .env.local
```

### Import Script Fails

**Symptom**: `import-properties-to-local.js` cannot insert data

**Solution**:
```bash
# Verify migrations applied
node scripts/verify-migration.js

# Check database is accessible
docker exec supabase-db psql -U postgres -c "SELECT 1"

# Verify CSV file exists
ls -la ./src/ga4Property/Amore_GA4_PropertList.csv

# Check for duplicate URLs
docker exec supabase-db psql -U postgres -c "SELECT url, COUNT(*) FROM properties GROUP BY url HAVING COUNT(*) > 1;"
```

### Connection Refused Errors

**Symptom**: Cannot connect to Supabase

**Solution**:
```bash
# Check all services are healthy
docker-compose ps

# Restart Kong gateway
docker-compose restart kong

# Verify ports are accessible
netstat -an | grep -E "8000|5432|3001"

# Check firewall isn't blocking ports
```

## Data Backup & Recovery

### Backup Database

```bash
# Export all data
docker exec supabase-db pg_dump -U postgres > backup-$(date +%Y%m%d).sql

# Export specific table
docker exec supabase-db pg_dump -U postgres -t properties > properties-backup.sql
```

### Restore Database

```bash
# Restore from backup
cat backup-20241114.sql | docker exec -i supabase-db psql -U postgres

# Restore specific table
cat properties-backup.sql | docker exec -i supabase-db psql -U postgres
```

### Export Properties Data

```bash
# Export to CSV
docker exec supabase-db psql -U postgres -c "COPY properties TO STDOUT WITH CSV HEADER" > properties-export.csv
```

## Next Steps

After successful migration:

1. **Update Application Config**: Point your app to local Supabase
   ```javascript
   const supabaseUrl = 'http://localhost:8000'
   const supabaseKey = process.env.SUPABASE_ANON_KEY
   ```

2. **Run Test Crawl**: Verify system works with local database
   ```bash
   npm start
   ```

3. **Monitor Logs**: Check for any database connection issues
   ```bash
   docker-compose logs -f db kong storage
   ```

4. **Access Studio**: Manage data visually
   ```
   http://localhost:3001
   ```

## Migration Checklist

- [ ] Docker Desktop running
- [ ] Local Supabase services started
- [ ] All services healthy (`docker-compose ps`)
- [ ] Migrations verified (`node scripts/verify-migration.js`)
- [ ] Storage bucket created (`node scripts/setup-storage.js`)
- [ ] Properties imported (`node scripts/import-properties-to-local.js`)
- [ ] Verification tests passed
- [ ] Studio accessible at http://localhost:3001
- [ ] Application configured to use local database

## Support

For issues:
1. Check service logs: `docker-compose logs [service-name]`
2. Review migration files in `supabase/migrations/`
3. Run verification script: `node scripts/verify-migration.js`
4. Consult SUPABASE_LOCAL_SETUP.md for infrastructure issues
