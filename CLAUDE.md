# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

GA4 Tech Issue Catcher is an automated validation system for Google Analytics 4 (GA4) and Google Tag Manager (GTM) configurations across 100+ Amorepacific digital properties. The system uses browser automation to validate measurement IDs, GTM container IDs, and page_view events, providing real-time monitoring through a web dashboard.

## Architecture

### Core Components

1. **Orchestrator (`src/modules/orchestrator.js`)**
   - Central coordination hub for the entire validation workflow
   - Manages browser pool, property validation, and result storage
   - Implements two-phase validation strategy:
     - Phase 1: Fast validation (20s timeout) for 95%+ of properties
     - Phase 2: Slow property re-validation (60s timeout) for timeout-exceeded properties
   - Queue-based work distribution for optimal parallel processing

2. **Browser Pool Manager (`src/modules/browserPoolManager.js`)**
   - Manages concurrent Playwright browser instances
   - Default pool size: 7 browsers (configurable via BROWSER_POOL_SIZE)
   - Implements stealth mode to avoid detection
   - Resource management with acquire/release pattern

3. **Network Event Capturer (`src/modules/networkEventCapturer.js`)**
   - Uses Chrome DevTools Protocol (CDP) for network interception
   - Captures GA4 events, GTM loads, and consent mode signals
   - Smart exit on expected measurement ID detection

4. **Supabase Integration**
   - Primary data store for properties, results, and screenshots
   - Tables: properties, crawl_runs, crawl_results, screenshots, retry_queue
   - Batch upload system with temp cache for reliability

5. **Web Dashboard (`src/server.js` + `public/`)**
   - Express server with WebSocket support
   - Real-time crawl progress updates
   - REST API for historical data access

### Data Flow

```
CSV/Supabase Properties → Orchestrator → Browser Pool → Validation → Temp Cache → Batch Upload → Supabase
                                ↓                                           ↓
                          WebSocket Updates                        Local Backup (optional)
```

## Common Commands

### Development

```bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install chromium

# Start web server (dashboard)
npm run server

# Run validation manually
npm start

# Development mode (server with auto-restart)
npm run dev
```

### Local Development with Supabase

This project supports both cloud Supabase (production) and local Supabase (development) environments.

**First-Time Setup:**
```bash
# 1. Install Supabase CLI
brew install supabase/tap/supabase

# 2. Start local Supabase (downloads Docker images, runs migrations)
supabase start

# 3. Switch to local environment
./scripts/switch-to-local.sh

# 4. Import properties data
node scripts/import-properties-to-local.js
```

**Daily Development Workflow:**
```bash
# Start local Supabase
supabase start

# Check service status
supabase status

# Start application
npm run server  # Terminal 1
npm start       # Terminal 2
```

**Environment Switching:**
```bash
# Switch to local Supabase (development)
./scripts/switch-to-local.sh

# Switch to cloud Supabase (production)
./scripts/switch-to-cloud.sh

# Emergency rollback to cloud
./scripts/rollback-to-cloud.sh

# Check current environment
cat .env | grep SUPABASE_URL
```

**Local Supabase Services:**
- API URL: http://127.0.0.1:54321
- Database: postgresql://postgres:postgres@127.0.0.1:54322/postgres
- Studio (Admin): http://127.0.0.1:54323
- Storage: http://127.0.0.1:54321/storage/v1/s3
- Mailpit (Email testing): http://127.0.0.1:54324

**Stopping Local Supabase:**
```bash
# Stop services (preserve data)
supabase stop

# Stop and delete all data
supabase stop --no-backup
```

**See:** [Local Supabase Migration Guide](docs/LOCAL_SUPABASE_MIGRATION.md) for comprehensive setup instructions.

### Testing

```bash
# Run all tests
npm test

# Run specific test file
node --test test/modules/orchestrator.test.js

# Test lifecycle components
npm run test:lifecycle

# Test specific functionality
node test-phase2-timeout.js
node test-consent-mode.js
```

### Migration Testing

```bash
# Run all migration tests with comprehensive reporting
npm run test:full-migration

# Individual migration tests
npm run test:local-connection      # Validate Supabase connectivity
npm run test:screenshot-comparison # Measure compression effectiveness
npm run test:e2e-local            # Full validation workflow

# View test reports
open ./test-reports/migration-test-latest.html
```

### Database Management

```bash
# Test Supabase connection (local or cloud)
npm run db:test

# Run migrations
npm run db:migrate

# Import properties from CSV to Supabase
npm run db:import

# Setup storage bucket
npm run storage:setup
```

### Debugging & Diagnostics

```bash
# Check specific property validation
node check-specific-property.js

# Query validation results
node query-crawl-results.js
node query-by-run-id.js

# Analyze issues
node check-report-mismatch.js
node diagnose-phase2-issue.js
```

## Configuration

### Environment Variables (.env)

Critical settings:
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`: Database connection
- `BROWSER_POOL_SIZE`: Number of concurrent browsers (default: 7)
- `GA4_TIMEOUT_MS`: Phase 1 timeout (default: 20000ms)
- `GA4_SLOW_TIMEOUT_MS`: Phase 2 timeout (default: 60000ms)
- `SERVER_PORT`: Web dashboard port (default: 3000)
- `RETENTION_DAYS`: File retention period (default: 30)

### Database Settings

Crawler timeout settings can be configured via database (`crawler_settings` table) which override environment variables.

## Key Validation Logic

### Two-Phase Validation Strategy

1. **Phase 1 (Fast Path)**
   - 20-second timeout per property
   - Captures 95%+ of properties successfully
   - Timeout-exceeded properties queued for Phase 2

2. **Phase 2 (Slow Path)**
   - 60-second timeout for slow-loading sites
   - Sequential processing with extended waits
   - Comprehensive user interaction simulation

### Validation Checks

1. **Measurement ID**: Extracts `tid` parameter from GA4 collect requests
2. **GTM Container ID**: Extracts `id` from GTM.js requests
3. **page_view Event**: Searches for `en=page_view` in GA4 events
4. **Consent Mode**: Auto-detects Google Consent Mode v2 usage
5. **AP_DATA**: Optional custom parameter validation

### Error Handling

- Retry logic with exponential backoff for network errors
- Service closure detection (Korean & English patterns)
- Server error handling with retry queue
- Timeout management with Phase 2 queueing

## Project Structure

```
src/
├── modules/           # Core business logic
├── routes/           # API endpoints
├── utils/            # Helper utilities
├── ga4Property/      # Property CSV data
├── server.js         # Express + WebSocket server
└── index.js          # Validation entry point

test/
├── modules/          # Unit tests
├── fixtures/         # Test data
└── e2e/             # End-to-end tests

results/             # Validation results (JSON)
screenshots/         # Full-page screenshots
logs/               # Execution logs
```

## Troubleshooting

### Common Issues

1. **Phase 2 Timeouts**: Check `crawler_settings` table for timeout configuration
2. **Missing GA4 Events**: Often due to lazy loading - user interaction simulation handles this
3. **Service Closed Sites**: Automatically detected and flagged in results
4. **WebSocket Connection**: Check server status and firewall settings

### Log Files

- `server.log`: Web server and API logs
- `backend.log`: Validation execution logs
- `frontend.log`: Dashboard UI logs

## Database Schema

Key tables:
- `properties`: Site configurations with expected IDs
- `crawl_runs`: Validation execution metadata
- `crawl_results`: Individual property validation results
- `screenshots`: Screenshot storage with metadata
- `retry_queue`: Failed properties for retry
- `crawler_settings`: Configurable timeout settings
- `cleanup_settings`: Automated cleanup configuration

## API Endpoints

Main endpoints:
- `GET /api/crawl/status` - Current crawl status
- `POST /api/crawl/start` - Start validation
- `GET /api/crawl/results/:date` - Historical results
- `GET /api/properties` - Property list
- `WebSocket /ws` - Real-time updates

## Performance Optimization

- Queue-based work distribution eliminates batch bottlenecks
- Browser pool reuse minimizes initialization overhead
- Temp cache with batch uploads reduces database load
- Smart exit on expected ID detection saves time
- Two-phase strategy optimizes for both fast and slow sites