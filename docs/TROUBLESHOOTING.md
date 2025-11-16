# Troubleshooting Guide

Comprehensive troubleshooting guide for GA4 Tech Issue Catcher with both cloud and local Supabase environments.

## Table of Contents
- [Quick Diagnostics](#quick-diagnostics)
- [Local Supabase Issues](#local-supabase-issues)
- [Cloud Supabase Issues](#cloud-supabase-issues)
- [Application Issues](#application-issues)
- [Browser Automation Issues](#browser-automation-issues)
- [Network and Performance Issues](#network-and-performance-issues)
- [Data and Storage Issues](#data-and-storage-issues)

## Quick Diagnostics

### Check Current Environment

```bash
# Check which environment you're using
cat .env | grep SUPABASE_URL

# Cloud: https://vmezpiybidirjxkehwer.supabase.co
# Local: http://127.0.0.1:54321
```

### Run Comprehensive Tests

```bash
# Run all migration tests
npm run test:full-migration

# View HTML report
open ./test-reports/migration-test-latest.html

# Or run individual tests
npm run test:local-connection      # Connection test
npm run test:screenshot-comparison # Compression test
npm run test:e2e-local            # Workflow test
```

### Quick Health Checks

```bash
# Check Docker status
docker ps

# Check Supabase services
supabase status

# Check application server
ps aux | grep "node src/server.js"

# Check logs
tail -f logs/backend.log
tail -f logs/server.log
```

## Local Supabase Issues

### Issue 1: Supabase CLI Won't Start

**Symptoms:**
```
Error: Cannot connect to the Docker daemon at unix:///Users/[user]/.docker/run/docker.sock
```

**Root Cause:** Docker Desktop is not running

**Solution:**
```bash
# 1. Start Docker Desktop
open -a Docker

# 2. Wait for Docker to be ready (check icon in menu bar)
# 3. Verify Docker is running
docker ps

# 4. Try starting Supabase again
supabase start
```

---

### Issue 2: Port Conflicts

**Symptoms:**
```
Error: Port 54321 is already in use
Error: Port 54322 is already in use
```

**Root Cause:** Another Supabase instance or application is using the ports

**Solution:**
```bash
# Find process using port 54321
lsof -i :54321

# Kill the process
kill -9 <PID>

# Or stop all Supabase instances
supabase stop

# Then start again
supabase start
```

---

### Issue 3: Migration Not Found Error

**Symptoms:**
```
Error: Migration fix-object-level not found
```

**Root Cause:** Supabase CLI version is too old (< v2.58.5)

**Solution:**
```bash
# Check current version
supabase --version

# Upgrade Supabase CLI
brew upgrade supabase/tap/supabase

# Verify version is >= v2.58.5
supabase --version

# Restart Supabase
supabase stop
supabase start
```

---

### Issue 4: Services Not Healthy

**Symptoms:**
```bash
supabase status
# Shows services with status != "healthy"
```

**Root Cause:** Docker resource constraints or initialization failures

**Solution:**
```bash
# 1. Stop all services
supabase stop

# 2. Check Docker resources
# Docker Desktop → Preferences → Resources
# Ensure: Memory >= 4GB, CPUs >= 2

# 3. Remove all containers and volumes
supabase stop --no-backup
docker volume prune -f

# 4. Start fresh
supabase start

# 5. Wait for all services to initialize (may take 2-3 minutes)
supabase status
```

---

### Issue 5: Database Connection Fails

**Symptoms:**
```
❌ Database Connection test failed
Error: Connection refused
```

**Root Cause:** Database not ready or wrong credentials

**Solution:**
```bash
# 1. Check Supabase is running
supabase status
# Database should show "healthy"

# 2. Verify environment variables
cat .env | grep SUPABASE

# Should show:
# SUPABASE_URL=http://127.0.0.1:54321
# SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
# SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# 3. Test database connection directly
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "SELECT 1;"

# 4. If still failing, check logs
supabase logs db

# 5. Restart database service
supabase stop
supabase start
```

---

### Issue 6: Storage Bucket Missing

**Symptoms:**
```
❌ Storage Bucket Access test failed
Error: Bucket 'screenshots' not found
```

**Root Cause:** Storage bucket not created

**Solution:**
```bash
# Create storage bucket
node scripts/setup-storage.js

# Expected output:
# ✅ Storage bucket 'screenshots' created
# ✅ Public access enabled
# ✅ Test upload successful

# Verify in Supabase Studio
open http://127.0.0.1:54323
# Navigate to Storage → Browse buckets
```

---

### Issue 7: Properties Table Empty

**Symptoms:**
```
❌ Table Access test shows 0 properties
```

**Root Cause:** Properties not imported

**Solution:**
```bash
# Import properties from CSV
node scripts/import-properties-to-local.js

# Expected output:
# ✅ Successfully imported 81 properties

# Verify import
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres
SELECT COUNT(*) FROM properties WHERE is_active = true;
\q

# Or check in Supabase Studio
open http://127.0.0.1:54323
# Navigate to Table Editor → properties
```

## Cloud Supabase Issues

### Issue 1: Storage Quota Exceeded

**Symptoms:**
```
Error: Storage quota exceeded (1GB limit)
Error: Failed to upload screenshot
```

**Root Cause:** Cloud Supabase free tier has 1GB storage limit

**Solution 1 - Switch to Local Supabase:**
```bash
# This is the recommended solution
./scripts/switch-to-local.sh

# Benefits:
# - Unlimited storage
# - Faster development
# - No cloud costs
```

**Solution 2 - Manual Cleanup:**
```bash
# Delete old screenshots from cloud (via Supabase Dashboard)
# 1. Go to https://app.supabase.com
# 2. Navigate to Storage → screenshots
# 3. Delete folders older than 30 days
```

---

### Issue 2: Connection Timeouts

**Symptoms:**
```
Error: Connection timeout
Error: Network request failed
```

**Root Cause:** Network latency or cloud service issues

**Solution:**
```bash
# 1. Check internet connection
ping google.com

# 2. Check Supabase status
# Visit: https://status.supabase.com

# 3. Increase timeouts in .env
PAGE_TIMEOUT_MS=60000  # Increase from 30000

# 4. Consider switching to local for development
./scripts/switch-to-local.sh
```

---

### Issue 3: Authentication Errors

**Symptoms:**
```
Error: Invalid API key
Error: Unauthorized
```

**Root Cause:** Invalid or expired credentials

**Solution:**
```bash
# 1. Verify credentials in .env
cat .env | grep SUPABASE

# 2. Get fresh keys from Supabase Dashboard
# https://app.supabase.com → Project Settings → API

# 3. Update .env with new keys
# SUPABASE_ANON_KEY=<new-key>
# SUPABASE_SERVICE_ROLE_KEY=<new-key>

# 4. Restart application
pm2 restart ga4-dashboard
```

## Application Issues

### Issue 1: Dashboard Not Loading

**Symptoms:**
- Browser shows "Cannot connect to server"
- Dashboard page is blank

**Root Cause:** Web server not running

**Solution:**
```bash
# 1. Check if server is running
ps aux | grep "node src/server.js"

# 2. If not running, start server
npm run server

# Or with PM2
pm2 start src/server.js --name ga4-dashboard

# 3. Check server logs
tail -f logs/server.log

# 4. Verify port is accessible
curl http://localhost:3000/api/status
```

---

### Issue 2: WebSocket Connection Failed

**Symptoms:**
- Dashboard shows "Offline" status
- No real-time updates

**Root Cause:** WebSocket connection blocked or server issue

**Solution:**
```bash
# 1. Check server is running
ps aux | grep "node src/server.js"

# 2. Check firewall settings
# Ensure port 3000 is not blocked

# 3. Check browser console for errors
# Open DevTools → Console

# 4. Verify WebSocket endpoint
curl http://localhost:3000/ws

# 5. Restart server
pm2 restart ga4-dashboard
```

---

### Issue 3: Validation Not Starting

**Symptoms:**
- `npm start` runs but no validation happens
- No results appear

**Root Cause:** Various - check logs

**Solution:**
```bash
# 1. Check backend logs
tail -f logs/backend.log

# 2. Verify properties exist
npm run db:test

# 3. Check CSV file
cat src/ga4Property/Amore_GA4_PropertList.csv | wc -l
# Should show ~106 lines

# 4. Test single property
node test-specific-property.js
```

## Browser Automation Issues

### Issue 1: Browser Not Installing

**Symptoms:**
```
Error: Playwright browser not found
Error: Browser executable doesn't exist
```

**Root Cause:** Playwright browsers not installed

**Solution:**
```bash
# 1. Install Chromium browser
npx playwright install chromium

# 2. If that fails, force reinstall
npx playwright install --force chromium

# 3. Verify installation
npx playwright --version
```

---

### Issue 2: Browser Crashes

**Symptoms:**
```
Error: Browser closed unexpectedly
Error: Page crashed
```

**Root Cause:** Memory issues or system constraints

**Solution:**
```bash
# 1. Reduce browser pool size
# Edit .env:
BROWSER_POOL_SIZE=3  # Reduce from 7

# 2. Increase system memory for Docker
# Docker Desktop → Preferences → Resources
# Memory: 8GB (if available)

# 3. Close other applications

# 4. Check system resources
top
# or
htop
```

---

### Issue 3: Screenshots Not Captured

**Symptoms:**
- Validation completes but no screenshots
- Screenshot files missing

**Root Cause:** Screenshot directory permissions or storage issues

**Solution:**
```bash
# 1. Check screenshot directory exists
ls -la screenshots/

# 2. Create directory if missing
mkdir -p screenshots

# 3. Fix permissions
chmod 755 screenshots

# 4. Check disk space
df -h

# 5. Verify screenshot capture in code
# Screenshots should be JPEG format (not PNG)
ls screenshots/*/
# Files should end with .jpg
```

## Network and Performance Issues

### Issue 1: Slow Validation

**Symptoms:**
- Validation takes >10 minutes for 100 properties
- Timeouts frequently occur

**Root Cause:** Network latency or insufficient browser pool

**Solution:**
```bash
# 1. Increase browser pool size
# Edit .env:
BROWSER_POOL_SIZE=10  # Increase from 7 (if system can handle it)

# 2. Increase timeouts for slow sites
GA4_SLOW_TIMEOUT_MS=90000  # Increase from 60000

# 3. Use local Supabase to reduce network latency
./scripts/switch-to-local.sh

# 4. Check network speed
speedtest-cli
```

---

### Issue 2: Memory Leaks

**Symptoms:**
- Application becomes slow over time
- System runs out of memory

**Root Cause:** Browser instances not properly closed

**Solution:**
```bash
# 1. Restart application
pm2 restart ga4-dashboard

# 2. Monitor memory usage
pm2 monit

# 3. Check for zombie browser processes
ps aux | grep chrome
# Kill if found: kill -9 <PID>

# 4. Reduce browser pool size
BROWSER_POOL_SIZE=5
```

## Data and Storage Issues

### Issue 1: Duplicate Properties

**Symptoms:**
- Same property appears multiple times in database

**Root Cause:** CSV has duplicates or import ran multiple times

**Solution:**
```bash
# 1. Check for duplicates
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres
SELECT representative_url, COUNT(*)
FROM properties
GROUP BY representative_url
HAVING COUNT(*) > 1;

# 2. Remove duplicates (keep newest)
DELETE FROM properties a USING properties b
WHERE a.id < b.id
AND a.representative_url = b.representative_url;

\q
```

---

### Issue 2: Screenshot Compression Not Working

**Symptoms:**
- Screenshots are still PNG format
- File sizes are 2-5MB instead of 200-500KB

**Root Cause:** Code not updated or old screenshots

**Solution:**
```bash
# 1. Verify screenshot format in code
grep -r "type.*jpeg" src/modules/

# Should show JPEG 60% in:
# - src/modules/orchestrator.js (2 locations)
# - src/modules/resultStorage.js
# - src/modules/orchestrator-integration.js

# 2. Check recent screenshots
ls -lh screenshots/*/
# Recent files should be .jpg and 200-500KB

# 3. Test compression
npm run test:screenshot-comparison

# 4. Clean old PNG screenshots
find screenshots -name "*.png" -delete
```

---

### Issue 3: Results Not Persisting

**Symptoms:**
- Validation runs but results not saved to database

**Root Cause:** Database connection issues or transaction failures

**Solution:**
```bash
# 1. Check database connection
npm run db:test

# 2. Check table permissions
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres
\dp crawl_results
# Should show INSERT permission

# 3. Check logs for errors
tail -f logs/backend.log | grep ERROR

# 4. Verify batch upload manager
# Check temp-cache/ directory
ls -la temp-cache/

# 5. Force manual batch upload
node scripts/force-batch-upload.js
```

## Getting Help

### Collect Diagnostic Information

Before requesting help, collect this information:

```bash
# System information
uname -a
node --version
npm --version
docker --version
supabase --version

# Application status
cat .env | grep SUPABASE_URL
ps aux | grep node
docker ps
supabase status

# Recent logs
tail -100 logs/backend.log > diagnostic-backend.log
tail -100 logs/server.log > diagnostic-server.log

# Test results
npm run test:full-migration > diagnostic-tests.log 2>&1
```

### Support Resources

1. **Documentation**
   - [README.md](../README.md) - Project overview
   - [LOCAL_SUPABASE_MIGRATION.md](./LOCAL_SUPABASE_MIGRATION.md) - Migration guide
   - [CLAUDE.md](../CLAUDE.md) - Developer guide

2. **Test Scripts**
   - `npm run test:full-migration` - Comprehensive tests
   - `npm run test:local-connection` - Connection validation
   - `npm run test:e2e-local` - Workflow testing

3. **Supabase Resources**
   - [Supabase Documentation](https://supabase.com/docs)
   - [Supabase Status Page](https://status.supabase.com)
   - [Supabase Community](https://github.com/supabase/supabase/discussions)

---

**Troubleshooting Guide Version:** 1.0
**Last Updated:** 2024-11-14
**Covers:** Local Supabase, Cloud Supabase, Application, Browser Automation
