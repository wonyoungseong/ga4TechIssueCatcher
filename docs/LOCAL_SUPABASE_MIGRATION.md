# Local Supabase Migration Guide

Complete guide for migrating GA4 Tech Issue Catcher from cloud Supabase to local Docker-based Supabase environment.

## Table of Contents
- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Migration Steps](#migration-steps)
- [Verification](#verification)
- [Rollback Procedures](#rollback-procedures)
- [Troubleshooting](#troubleshooting)
- [Architecture Changes](#architecture-changes)

## Overview

### Why Local Supabase?

**Problem Solved:**
- **Storage Quota Issues**: Cloud Supabase free tier has 1GB storage limit
- **Screenshot Volume**: 100+ properties × 365 days × 2-5MB per screenshot = massive storage needs
- **Cost Reduction**: Eliminates cloud storage costs for development and testing

**Benefits:**
- ✅ **Unlimited Storage**: No quota limits on local disk
- ✅ **Faster Development**: No network latency for database/storage operations
- ✅ **Cost Savings**: ~70-80% storage reduction with JPEG 60% compression
- ✅ **Full Control**: Complete control over infrastructure and data
- ✅ **Offline Development**: Work without internet connection

### What Changed?

**Before (Cloud Supabase):**
- Database: `https://vmezpiybidirjxkehwer.supabase.co`
- Storage: Cloud-based with 1GB limit
- Screenshots: PNG format (2-5MB each)
- Environment: Production-only

**After (Local Supabase):**
- Database: `http://127.0.0.1:54321` (Kong API Gateway)
- Storage: Local filesystem with unlimited space
- Screenshots: JPEG 60% format (200-500KB each)
- Environment: Cloud (production) + Local (development)

## Prerequisites

### Required Software

1. **Docker Desktop 4.0+**
   ```bash
   # macOS
   brew install --cask docker

   # Ubuntu
   sudo apt-get update
   sudo apt-get install docker-ce docker-ce-cli containerd.io
   ```

2. **Supabase CLI v2.58.5+**
   ```bash
   # macOS
   brew install supabase/tap/supabase

   # Upgrade if already installed
   brew upgrade supabase/tap/supabase

   # Verify version
   supabase --version  # Should be >= v2.58.5
   ```

3. **Node.js 18+ LTS**
   ```bash
   node --version  # Should be >= v18.0.0
   npm --version
   ```

### System Requirements

- **Disk Space**: 5GB minimum (for Docker images + database + screenshots)
- **Memory**: 4GB RAM minimum (8GB recommended)
- **CPU**: 2 cores minimum (4 cores recommended)

## Migration Steps

### Step 1: Backup Cloud Data (IMPORTANT!)

**Before switching to local, export your cloud data for safekeeping:**

```bash
# Export cloud properties data
node scripts/export-cloud-data.js

# Creates backup at:
# - ./backups/cloud-properties-{timestamp}.json
# - ./backups/cloud-properties-{timestamp}.csv
```

**Manual Backup (Alternative):**
```bash
# Using Supabase Dashboard
1. Go to https://app.supabase.com
2. Navigate to Table Editor → properties
3. Click "Download as CSV"
4. Save to ./backups/
```

### Step 2: Install and Start Local Supabase

```bash
# 1. Install Supabase CLI (if not already installed)
brew install supabase/tap/supabase

# 2. Initialize Supabase in project (first time only)
supabase init  # This creates supabase/ directory

# 3. Start all Supabase services
supabase start

# This will:
# - Download all required Docker images (~2GB)
# - Start 12 Docker containers
# - Run all database migrations automatically
# - Output connection details and API keys
```

**Expected Output:**
```
Started supabase local development setup.

API URL: http://127.0.0.1:54321
GraphQL URL: http://127.0.0.1:54321/graphql/v1
DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
Studio URL: http://127.0.0.1:54323
Inbucket URL: http://127.0.0.1:54324
JWT secret: super-secret-jwt-token-with-at-least-32-characters-long
anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Save these credentials!** They are needed for the next steps.

### Step 3: Switch to Local Environment

```bash
# Switch environment configuration to local
./scripts/switch-to-local.sh

# This script will:
# ✅ Validate .env.local exists
# ✅ Create backup of current .env
# ✅ Copy .env.local to .env
# ✅ Validate local configuration
# ✅ Check Docker status
# ✅ Start Supabase if not running
```

**Verify environment switch:**
```bash
# Check current environment
cat .env | grep SUPABASE_URL
# Should show: SUPABASE_URL=http://127.0.0.1:54321

# Verify Supabase services
supabase status
# All services should show "healthy"
```

### Step 4: Import Properties Data

```bash
# Import properties from CSV to local database
node scripts/import-properties-to-local.js

# Expected output:
# ✅ Reading CSV file...
# ✅ Parsing 106 properties
# ✅ Importing to local Supabase...
# ✅ Successfully imported 81 properties
# ✅ 44 unique brands
# ✅ 0 errors
```

**Note**: The script automatically handles:
- Slug generation from URLs
- Brand extraction from property names
- Region parsing from naming patterns
- Duplicate handling via upsert

### Step 5: Setup Storage Bucket

```bash
# Create screenshots bucket with proper configuration
node scripts/setup-storage.js

# Expected output:
# ✅ Storage bucket 'screenshots' created
# ✅ Public access enabled
# ✅ MIME types: image/jpeg, image/jpg, image/png
# ✅ File size limit: 10MB
# ✅ Test upload successful
```

### Step 6: Verify Migration

```bash
# Run comprehensive verification tests
npm run test:full-migration

# This runs 3 test suites:
# 1. Connection Test - Validates database, tables, storage, auth
# 2. Screenshot Compression - Measures JPEG effectiveness
# 3. End-to-End Test - Full validation workflow

# Generates reports at:
# - ./test-reports/migration-test-latest.html
# - ./test-reports/migration-test-{date}.json
```

**Alternative - Run individual tests:**
```bash
# Test database connection
npm run test:local-connection

# Test screenshot compression
npm run test:screenshot-comparison

# Test end-to-end workflow
npm run test:e2e-local
```

## Verification

### Database Verification

**Check tables exist:**
```bash
# Using Supabase Studio
open http://127.0.0.1:54323

# Or using psql
supabase db dump --schema public
```

**Verify data imported:**
```sql
-- Connect to database
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres

-- Check properties count
SELECT COUNT(*) FROM properties WHERE is_active = true;
-- Should show ~81 properties

-- Check tables exist
\dt
-- Should list: properties, crawl_runs, crawl_results, screenshots, retry_queue, etc.

-- Exit
\q
```

### Storage Verification

**Check bucket exists:**
```bash
# Using Supabase Studio
open http://127.0.0.1:54323
# Navigate to Storage → Browse buckets → screenshots

# Or using test script
node scripts/test-local-connection.js
# Test 3: Storage Bucket Access should PASS
```

### Application Verification

**Run a test crawl:**
```bash
# Start server
npm run server

# In another terminal, run validation
npm start

# Check results
open http://localhost:3000
# Dashboard should show validation results
```

**Verify screenshots:**
- Screenshots should be saved as JPEG (not PNG)
- File sizes should be 200-500KB (not 2-5MB)
- Check `screenshots/` directory for local files

## Rollback Procedures

### Emergency Rollback to Cloud Supabase

**If you need to switch back to cloud immediately:**

```bash
# Switch back to cloud environment
./scripts/rollback-to-cloud.sh

# This script will:
# ✅ Stop local Supabase services
# ✅ Validate .env.cloud exists
# ✅ Create backup of current .env
# ✅ Copy .env.cloud to .env
# ✅ Validate cloud configuration
# ✅ Provide cleanup instructions
```

**Verify rollback:**
```bash
# Check current environment
cat .env | grep SUPABASE_URL
# Should show: SUPABASE_URL=https://vmezpiybidirjxkehwer.supabase.co

# Test cloud connection
node scripts/test-cloud-connection.js
```

### Stop Local Supabase Services

```bash
# Stop all services (preserves data)
supabase stop

# Stop and remove all data (complete reset)
supabase stop --no-backup

# Check no services running
docker ps
# Should show no supabase containers
```

### Restore Cloud Data

**If you need to restore data to cloud:**

```bash
# 1. Ensure cloud environment active
./scripts/switch-to-cloud.sh

# 2. Export data from local (if needed)
node scripts/export-local-data.js

# 3. Import to cloud
node scripts/import-properties-to-cloud.js ./backups/local-properties-{timestamp}.csv
```

## Troubleshooting

### Common Issues

#### Issue 1: Supabase CLI Won't Start

**Symptoms:**
```
Error: Cannot connect to the Docker daemon
```

**Solutions:**
```bash
# 1. Check Docker Desktop is running
open -a Docker

# 2. Wait for Docker to fully start
docker ps

# 3. Try starting Supabase again
supabase start
```

#### Issue 2: Port Conflicts

**Symptoms:**
```
Error: Port 54321 is already in use
```

**Solutions:**
```bash
# Find process using port
lsof -i :54321

# Kill the process
kill -9 <PID>

# Or stop conflicting Supabase instance
supabase stop
supabase start
```

#### Issue 3: Migration Not Found

**Symptoms:**
```
Error: Migration fix-object-level not found
```

**Solutions:**
```bash
# Upgrade Supabase CLI
brew upgrade supabase/tap/supabase

# Verify version is >= v2.58.5
supabase --version

# Restart Supabase
supabase stop
supabase start
```

#### Issue 4: Connection Test Fails

**Symptoms:**
```
❌ Database Connection test failed
```

**Solutions:**
```bash
# 1. Check Supabase is running
supabase status
# All services should show "healthy"

# 2. Check environment variables
cat .env | grep SUPABASE
# Should show local URLs and keys

# 3. Verify Docker containers
docker ps | grep supabase
# Should show 11-12 running containers

# 4. Check logs
supabase logs
```

#### Issue 5: Properties Import Fails

**Symptoms:**
```
Error: Table 'properties' does not exist
```

**Solutions:**
```bash
# 1. Check migrations ran
supabase db dump --schema public

# 2. Run migrations manually
supabase db push

# 3. Verify tables exist
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres
\dt
\q

# 4. Try import again
node scripts/import-properties-to-local.js
```

### Advanced Troubleshooting

**Check Docker logs:**
```bash
# View all Supabase logs
supabase logs

# View specific service logs
docker logs supabase-db
docker logs supabase-kong
docker logs supabase-storage
```

**Reset everything (CAUTION - deletes all data):**
```bash
# Stop and remove all data
supabase stop --no-backup

# Remove volumes
docker volume prune -f

# Start fresh
supabase start
```

**Database access issues:**
```bash
# Reset database password
supabase db reset

# Check database connection
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "SELECT 1;"
```

## Architecture Changes

### File Storage Strategy

**Before (Cloud):**
```
Supabase Storage (Cloud)
└── screenshots/
    └── {run_id}/
        └── {property_id}_{timestamp}.png (2-5MB each)
```

**After (Local + Compression):**
```
Option 1: Supabase Storage (Local)
└── screenshots/
    └── {run_id}/
        └── {property_id}_{timestamp}.jpg (200-500KB each)

Option 2: Local Filesystem (Fallback)
└── screenshots/
    └── YYYY-MM-DD/
        └── {property}-{timestamp}.jpg (200-500KB each)
```

### Database Schema

**All tables migrated:**
- ✅ properties (81 records)
- ✅ crawl_runs
- ✅ crawl_results
- ✅ screenshots
- ✅ retry_queue
- ✅ property_status_history
- ✅ cleanup_settings

**New indexes for performance:**
- idx_crawl_results_run_property
- idx_screenshots_run_property
- idx_retry_queue_status_next_retry

### Environment Variables

**Added for local Supabase:**
```bash
# Local Supabase (via Kong Gateway)
SUPABASE_URL=http://127.0.0.1:54321

# Standard demo keys for local development
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Docker compose configuration
POSTGRES_PASSWORD=your-super-secret-password
JWT_SECRET=your-super-secret-jwt-token-with-at-least-32-characters
```

**Preserved from original:**
```bash
# Application settings (unchanged)
CSV_PATH=./src/ga4Property/Amore_GA4_PropertList.csv
BROWSER_POOL_SIZE=7
GA4_TIMEOUT_MS=20000
GA4_SLOW_TIMEOUT_MS=60000
SERVER_PORT=3000
RETENTION_DAYS=30
```

### Screenshot Compression

**Implemented in all capture locations:**
- src/modules/orchestrator.js (Phase 1 & Phase 2)
- src/modules/resultStorage.js
- src/modules/orchestrator-integration.js

**Compression settings:**
```javascript
await page.screenshot({
  fullPage: true,
  type: 'jpeg',
  quality: 60
});
```

**Results:**
- 70-80% file size reduction
- PNG: 2-5MB → JPEG 60%: 200-500KB
- Annual savings: ~38GB+ for 106 properties × 365 days

## Post-Migration Checklist

- [ ] Local Supabase running: `supabase status`
- [ ] Environment switched: `cat .env | grep SUPABASE_URL`
- [ ] Properties imported: `psql -c "SELECT COUNT(*) FROM properties;"`
- [ ] Storage bucket created: Open http://127.0.0.1:54323
- [ ] All tests pass: `npm run test:full-migration`
- [ ] Application runs: `npm run server` + `npm start`
- [ ] Screenshots saved as JPEG: Check file extensions
- [ ] Dashboard accessible: Open http://localhost:3000
- [ ] Cloud backup created: Check `./backups/` directory
- [ ] .env.cloud preserved: `cat .env.cloud`

## Support and Resources

### Documentation
- [Main README](../README.md) - Project overview
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Detailed troubleshooting guide
- [CLAUDE.md](../CLAUDE.md) - Developer guide with local setup

### Scripts
- `scripts/switch-to-local.sh` - Switch to local environment
- `scripts/switch-to-cloud.sh` - Switch to cloud environment
- `scripts/rollback-to-cloud.sh` - Emergency rollback
- `scripts/test-local-connection.js` - Validate local setup
- `scripts/test-full-migration.js` - Comprehensive test suite

### Supabase Resources
- [Supabase Local Development Docs](https://supabase.com/docs/guides/cli/local-development)
- [Supabase CLI Reference](https://supabase.com/docs/reference/cli)
- [Docker Documentation](https://docs.docker.com/)

---

**Migration Guide Version:** 1.0
**Last Updated:** 2024-11-14
**Compatible with:** Supabase CLI v2.58.5+, Docker Desktop 4.0+
