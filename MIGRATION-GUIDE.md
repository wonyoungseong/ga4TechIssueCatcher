# Database Migration Guide - Story 10.3

## Migration Status: Pending Application ⏳

**Phase 1 Code Implementation**: ✅ Complete
**Database Migration**: ⏳ Requires Manual Application

## Issue
Both automated migration methods failed:
- Supabase MCP: Authorization error (not configured)
- Programmatic script: Supabase doesn't expose `exec` RPC function

## Manual Migration Steps

### Option 1: Supabase Dashboard (Recommended)

1. **Open Supabase SQL Editor**
   - URL: https://supabase.com/dashboard/project/vmezpiybidirjxkehwer/sql
   - Or navigate: Dashboard → SQL Editor

2. **Execute Migration SQL**
   - Copy entire contents of `supabase/migrations/004_retry_queue.sql`
   - Paste into SQL Editor
   - Click "RUN" button

3. **Verify Table Creation**
   ```sql
   SELECT * FROM retry_queue LIMIT 1;
   ```
   Should return: `0 rows` (table exists but empty)

### Option 2: CLI (If Supabase CLI is configured)

```bash
# Install Supabase CLI if not installed
npm install -g supabase

# Link to project
supabase link --project-ref vmezpiybidirjxkehwer

# Apply migration
supabase db push
```

## What the Migration Creates

### Table: `retry_queue`
- **Purpose**: Queue for retrying failed property validations
- **Columns**:
  - `id` (UUID, PK) - Unique identifier
  - `property_id` (UUID, FK) - References properties table
  - `crawl_run_id` (UUID, FK) - References crawl_runs table
  - `failure_reason` (TEXT) - Why validation failed
  - `failure_count` (INT) - Number of retry attempts (1-3)
  - `last_attempt_at` (TIMESTAMP) - Last retry timestamp
  - `next_retry_at` (TIMESTAMP) - When to retry next
  - `status` (TEXT) - pending|retrying|resolved|permanent_failure
  - `created_at` (TIMESTAMP) - Entry creation time
  - `updated_at` (TIMESTAMP) - Last modification time

### Indexes Created
- `idx_retry_queue_status` - Status lookups
- `idx_retry_queue_next_retry` - Next retry time queries
- `idx_retry_queue_property` - Property lookups
- `idx_retry_queue_status_next_retry` - Combined status + time queries

### Triggers Created
- `trigger_retry_queue_updated_at` - Auto-updates `updated_at` on row changes

## Verification Steps

After applying migration:

1. **Check Table Exists**
   ```sql
   SELECT table_name FROM information_schema.tables
   WHERE table_name = 'retry_queue';
   ```

2. **Check Indexes**
   ```sql
   SELECT indexname FROM pg_indexes
   WHERE tablename = 'retry_queue';
   ```

3. **Test Insert (Optional)**
   ```sql
   -- Will fail if foreign keys don't exist, but validates structure
   SELECT column_name, data_type, is_nullable
   FROM information_schema.columns
   WHERE table_name = 'retry_queue'
   ORDER BY ordinal_position;
   ```

## Post-Migration Testing

Once migration is applied, test the retry queue system:

```bash
# Start server
node src/server.js

# In another terminal, test API endpoints
curl http://localhost:3000/api/retry-queue/stats
curl http://localhost:3000/api/retry-queue/list
```

## Migration File Location
`supabase/migrations/004_retry_queue.sql`

## Related Code Changes (Already Applied)
- ✅ `src/modules/orchestrator.js:1089-1116` - Auto-insert on Phase 2 failure
- ✅ `src/modules/retryQueue.js` - Retry processing logic
- ✅ `src/routes/retry.js` - API endpoints
- ✅ `src/server.js:24,127` - Router registration

## Next Steps After Migration

1. Trigger a crawl with a known slow property (e.g., Innisfree KR)
2. Watch for Phase 2 timeout
3. Verify entry added to `retry_queue` table
4. Wait 30 minutes or manually trigger: `POST /api/retry-queue/process`
5. Check retry statistics: `GET /api/retry-queue/stats`
