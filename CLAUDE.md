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

## Environment Configuration

### Overview

This application supports two deployment modes with different feature sets based on resource constraints:

- **Local Environment**: Full-featured development with browser automation and crawling capabilities
- **Render Environment**: Read-only dashboard for monitoring (crawling disabled due to 512MB memory limit)

The application automatically detects its environment using the `RENDER` environment variable and disables resource-intensive features when deployed on memory-constrained platforms.

### Local Environment (Development + Crawling)

**Features:**
- ✅ Full crawling execution with Playwright browser automation
- ✅ All schedulers active (cleanup + retry queue)
- ✅ WebSocket real-time progress updates
- ✅ Complete dashboard functionality with crawl controls
- ✅ Browser pool configuration (1-7 concurrent browsers)

**Setup:**
```bash
# No special environment variables needed
npm run server  # Terminal 1 - Start web server
npm start       # Terminal 2 - Run validation
```

**Memory Requirements:** ~500MB-2GB (depends on `BROWSER_POOL_SIZE` configuration)

**When to Use:**
- Local development and testing
- Running validation crawls
- Debugging validation issues
- Full system functionality

### Render Environment (Production - Read-only Dashboard)

**Features:**
- ✅ Dashboard for viewing historical validation results
- ✅ WebSocket real-time updates (from external crawl sources)
- ✅ Cleanup scheduler (automated data lifecycle management)
- ✅ REST API for result queries
- ❌ Crawling disabled (prevents memory exhaustion)
- ❌ Retry queue scheduler disabled (can't trigger crawls)
- ❌ Browser automation not available

**Automatic Configuration:**
- Render.com automatically sets `RENDER=true` environment variable
- Application detects environment and disables crawl-related features
- No manual configuration required for environment detection

**Memory Requirements:** <100MB (no browser processes, minimal overhead)

**When to Use:**
- Production dashboard deployment
- Viewing results from local crawl executions
- Sharing validation results with team members
- Monitoring validation history

### Environment Variables

| Variable | Local Default | Render Value | Purpose |
|----------|---------------|--------------|---------|
| `RENDER` | `undefined` | `true` (auto) | Detect Render.com deployment environment |
| `DISABLE_CRAWL_START` | `undefined` | optional | Manual override to disable crawling |
| `NODE_ENV` | `development` | `production` | Node.js environment mode |
| `SUPABASE_URL` | local/cloud | cloud URL | Database connection endpoint |
| `SUPABASE_ANON_KEY` | local/cloud key | cloud key | Database authentication key |
| `SERVER_PORT` | `3000` | (assigned) | HTTP server port |
| `BROWSER_POOL_SIZE` | `7` | N/A | Browser concurrency (local only) |
| `GA4_TIMEOUT_MS` | `20000` | N/A | Phase 1 timeout (local only) |
| `GA4_SLOW_TIMEOUT_MS` | `60000` | N/A | Phase 2 timeout (local only) |
| `RETRY_QUEUE_ENABLED` | `true` | auto-disabled | Retry scheduler activation |

### Architecture Differences

**Local Development:**
```
Browser Pool (Playwright)
         ↓
    Validation Engine
         ↓
   Supabase (local or cloud)
         ↓
   Dashboard (http://localhost:3000)
```

**Render Deployment:**
```
External Local Crawl → Supabase Cloud ← Cloudflare Tunnel ← Local Supabase
                              ↓
                     Dashboard (read-only)
                     https://ga4-tech-catcher.onrender.com
```

### Feature Availability Matrix

| Feature | Local Environment | Render Environment |
|---------|------------------|-------------------|
| Start Crawl | ✅ | ❌ (403 error) |
| View Results | ✅ | ✅ |
| Real-time Updates | ✅ | ✅ |
| Browser Pool | ✅ (configurable) | ❌ |
| Retry Scheduler | ✅ | ❌ (auto-disabled) |
| Cleanup Scheduler | ✅ | ✅ |
| API Access | ✅ | ✅ (read-only) |

### Troubleshooting

**Issue: Crawl button missing on local environment**
- **Check**: `RENDER` environment variable should NOT be set
- **Check**: `DISABLE_CRAWL_START` should not be `true`
- **Verify**: `curl http://localhost:3000/api/environment` should return `crawlDisabled: false`
- **Solution**: Unset environment variables and restart server

**Issue: 502 Bad Gateway errors on Render**
- **Cause**: Render may be restarting due to memory limit exceeded
- **Check**: Render dashboard logs for memory warnings
- **Verify**: `RENDER=true` is set (should be automatic)
- **Solution**: Ensure no one is triggering crawls remotely (API protection should prevent this)

**Issue: Retry scheduler running on Render (should not run)**
- **Check**: Server startup logs should show "ℹ️  Retry queue scheduler disabled (read-only environment)"
- **Verify**: `src/utils/environment.js` - `isCrawlDisabled()` returns true on Render
- **Solution**: Check environment variable configuration and server logs

**Issue: "Crawl execution is disabled" error message**
- **Expected**: This is normal behavior on Render environment
- **Solution**: Run crawls from local environment, view results on Render dashboard

**Issue: Dashboard shows crawl controls on Render**
- **Check**: Frontend should fetch `/api/environment` and hide controls when `crawlDisabled: true`
- **Verify**: Browser console for environment fetch errors
- **Solution**: Hard refresh browser (Ctrl+Shift+R) to clear cached frontend

### Environment Detection Implementation

The environment detection system is implemented in three layers:

1. **Backend Protection** (`src/routes/crawl.js`):
   - POST `/api/crawl/start` returns 403 when crawl is disabled
   - Error response includes reason code: `CRAWL_DISABLED`

2. **Frontend Adaptation** (`front/crawler-monitor/src/pages/Dashboard.js`):
   - Fetches environment info on mount: `GET /api/environment`
   - Conditionally renders banner (crawl disabled) or controls (crawl enabled)
   - Fail-safe default: assumes crawl enabled if fetch fails

3. **Scheduler Control** (`src/server.js`):
   - Retry scheduler checks `isCrawlDisabled()` before starting
   - Cleanup scheduler always runs (data management, not resource-intensive)

**Detection Logic:**
```javascript
// src/utils/environment.js
export function isCrawlDisabled() {
  return process.env.RENDER === 'true' ||
         process.env.DISABLE_CRAWL_START === 'true';
}
```

**See Also:**
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Comprehensive deployment guide for Render, Cloudflare Tunnel, and local environments

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

## Development Workflow

### BMAD Method (Build-Measure-Analyze-Decide)

This project follows the BMAD development methodology for continuous improvement:

1. **Build**: Implement features incrementally using Git worktrees
2. **Measure**: Collect metrics and validation results through automated testing
3. **Analyze**: Review test results, performance data, and validation outcomes
4. **Decide**: Make informed decisions based on evidence and data

### Git Worktree Workflow

**Issue Resolution with Worktrees:**
```bash
# Create worktree and auto-resolve issue
./create-worktree.sh issue-72

# Manual worktree creation
git worktree add ./worktrees/issue-72 -b issue-72
cd ./worktrees/issue-72
```

**Parallel Development:**
- Each issue gets isolated worktree for independent development
- Main branch remains stable while multiple features are developed simultaneously
- Clean separation between production and experimental code

### Claude Code Permissions

**Pass Permissions Mode**: This project uses pass permissions to streamline development workflow. Claude Code can execute the following operations without explicit approval:

```bash
# Approved operations (no user confirmation required)
- File operations: Read, Write, Edit, MultiEdit
- Testing: npm test, npm run test:*
- Development commands: npm start, npm run server, npm run dev
- Database operations: npm run db:test, npm run db:migrate
- Git operations: git status, git diff, git log (read-only)
- Lint operations: npm run lint

# Operations requiring confirmation
- Git commits and pushes
- Production deployments
- Database schema changes in production
- Deletion of files or data
```

**Custom Commands Integration:**
- `/decompose-issue`: Break down complex tasks into manageable issues
- `/resolve-issue <number>`: Automatically resolve GitHub issues with comprehensive workflow
- Both commands work seamlessly with worktree-based development

**Workflow Example:**
```bash
# 1. Decompose complex feature
claude "/decompose-issue Implement advanced GA4 validation"

# 2. Auto-create GitHub issues (if approved)

# 3. Resolve issue in isolated worktree
./create-worktree.sh issue-72  # Auto-triggers /resolve-issue 72
```

### BMAD Agent-Based Development

**BMAD = Build-Measure-Analyze-Decide**: Evidence-based development with specialized AI agents.

**Agent Roles:**
- **Dev (James) 💻**: Implementation specialist - writes code, tests, and fixes issues
- **QA (Quinn) 🧪**: Test architect - comprehensive quality review and gate decisions

**Complete Development Cycle:**

```bash
# 1. Create Epic & Story
claude "brownfield-create-epic Implement consent mode tracking"
claude "create-next-story"  # Generates 1.1.story.md with full context

# 2. Development Phase (Dev Agent)
claude "/dev *develop-story"
# → Implements tasks sequentially
# → Writes comprehensive tests
# → Status: Ready for Review

# 3. Quality Review (QA Agent)
claude "/qa *review 1.1"
# → Comprehensive quality assessment
# → Active code refactoring where safe
# → Generates quality gate decision (PASS/CONCERNS/FAIL/WAIVED)
# → Output: docs/project/qa/gates/1.1-{slug}.yml

# 4. Fix Application (Dev Agent)
claude "/dev *review-qa"
# → Reads QA gate and assessments
# → Applies fixes in priority order
# → Status: Ready for Done or Ready for Review

# 5. Final Verification (if needed)
claude "/qa *review 1.1"
# → Updated gate file
# → Story Status: Done
```

**Key BMAD Principles:**
- **Build**: Incremental implementation with Git worktrees
- **Measure**: Automated testing and validation metrics
- **Analyze**: Quality assessments with evidence-based gates
- **Decide**: Data-driven decisions for next steps

**Story File Permissions:**
- **Dev Agent**: Can ONLY update Tasks/Subtasks, Dev Agent Record, File List, Change Log, Status
- **QA Agent**: Can ONLY update QA Results section
- **No agent modifies**: Story content, Acceptance Criteria, or other sections

**Quality Gate Criteria:**
- **PASS**: All critical requirements met, no blocking issues
- **CONCERNS**: Non-critical issues found, team should review
- **FAIL**: Critical issues requiring immediate fixes
- **WAIVED**: Issues acknowledged but explicitly waived with reason

**BMAD Project Structure:**
```
.claude/commands/BMad/
├── README.md              # Complete BMAD workflow guide
├── agents/               # Agent role definitions
│   ├── dev.md           # Dev agent configuration
│   └── qa.md            # QA agent configuration
└── tasks/               # Executable workflows
    ├── create-next-story.md
    ├── review-story.md
    └── apply-qa-fixes.md

docs/project/
├── stories/             # Development stories
│   └── {epic}.{story}.story.md
└── qa/                 # QA artifacts
    ├── gates/          # Quality gate decisions
    └── assessments/    # Risk, NFR, test design
```

**See:** [BMAD Workflow Guide](.claude/commands/BMad/README.md) for comprehensive documentation.

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