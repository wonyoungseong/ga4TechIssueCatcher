# Supabase Storage Setup Guide

## 1. Create Screenshots Bucket

### Via Supabase Dashboard:

1. Navigate to your Supabase project: https://supabase.com/dashboard
2. Go to **Storage** in the left sidebar
3. Click **New bucket**
4. Configure the bucket:
   ```
   Name: screenshots
   Public bucket: ✅ (Checked)
   ```
5. Click **Create bucket**

### Bucket Policies (Optional - for auto-cleanup):

After creating the bucket, you can set up Row Level Security (RLS) policies if needed:

```sql
-- Allow public read access
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'screenshots');

-- Allow service role full access
CREATE POLICY "Service Role Access"
ON storage.objects FOR ALL
USING (bucket_id = 'screenshots');
```

## 2. Run Database Migration

Execute the migration SQL in your Supabase SQL Editor:

**File**: `supabase/migrations/20250102_data_lifecycle_management.sql`

1. Go to **SQL Editor** in Supabase Dashboard
2. Create new query
3. Copy and paste the entire contents of the migration file
4. Click **Run**

## 3. Verify Setup

### Check Bucket Creation:
```bash
# List all buckets
curl -X GET 'https://[YOUR-PROJECT].supabase.co/storage/v1/bucket' \
  -H "Authorization: Bearer [YOUR-ANON-KEY]"
```

### Check Migration Success:
```sql
-- Verify new columns exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'crawl_runs'
  AND column_name IN ('upload_completed_at', 'upload_duration_ms', 'upload_success_count', 'upload_failed_count');

-- Verify RPC functions exist
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('find_orphaned_crawl_results', 'get_cleanup_statistics', 'move_crawl_to_permanent_storage', 'cleanup_expired_data');
```

## 4. Configuration

Ensure your `.env` file has the following variables:

```bash
# Supabase Configuration
SUPABASE_URL=https://[YOUR-PROJECT].supabase.co
SUPABASE_SERVICE_ROLE_KEY=[YOUR-SERVICE-ROLE-KEY]

# Data Lifecycle Configuration
UNSAVED_CRAWL_TTL_DAYS=30
SCREENSHOT_TTL_DAYS=30
LOCAL_BACKUP_ENABLED=true
CLEANUP_BATCH_SIZE=100
CLEANUP_CRON=0 3 * * *
```

## 5. Test Storage Upload

You can test the storage upload with the provided test script:

```bash
npm run test:storage
```

Or manually test via Supabase Storage:

1. Go to **Storage** → **screenshots** bucket
2. Try uploading a test image
3. Verify it appears in the bucket
4. Check the public URL format: `https://[PROJECT].supabase.co/storage/v1/object/public/screenshots/[filename]`

## Troubleshooting

### Bucket Creation Fails
- **Issue**: Permission denied
- **Solution**: Ensure you're logged in as project owner or have storage admin permissions

### Migration Fails
- **Issue**: Column already exists
- **Solution**: The migration uses `IF NOT EXISTS` clauses, so re-running is safe

### Upload Fails
- **Issue**: Storage quota exceeded
- **Solution**: Check your Supabase plan limits or upgrade plan

### RPC Functions Not Found
- **Issue**: Functions not created
- **Solution**: Ensure migration ran successfully, check for SQL syntax errors

## Next Steps

After completing the setup:

1. ✅ Storage bucket created
2. ✅ Database migration applied
3. ✅ Environment variables configured
4. → Test the temp cache system
5. → Test batch upload functionality
6. → Verify cleanup scheduler
7. → Run end-to-end crawl test
