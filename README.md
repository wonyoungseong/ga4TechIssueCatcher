# GA4 Tech Issue Catcher 🚀

Automated GA4/GTM configuration validation system with real-time web dashboard for 100+ Amorepacific digital properties.

## Overview

This system automatically validates GA4 Measurement IDs, GTM Container IDs, and page_view events across all Amorepacific properties. It provides a real-time web dashboard for monitoring validation status and viewing results.

## Features

✅ **CSV-based Property Management** - Dynamic configuration without code changes
✅ **Parallel Browser Automation** - 5 concurrent Playwright instances
✅ **Chrome DevTools Protocol** - Network event interception for GA4 validation
✅ **Automated Validation** - Measurement ID, GTM ID, page_view event checks
✅ **Screenshot Capture** - Full-page evidence for all validations
✅ **Web Dashboard** - Real-time monitoring with REST API and WebSocket
✅ **Automated Cleanup** - 30-day retention with automatic file deletion

## Quick Start

### Prerequisites

- Node.js 18+ LTS
- Linux server (Ubuntu 20.04+ recommended) or local development environment
- **Docker Desktop** (for local Supabase)
- **Supabase CLI v2.58.5+** (for local development)

### Environment Setup

This project supports both **cloud Supabase** (production) and **local Supabase** (development) configurations.

#### Local Supabase Setup (Recommended for Development)

```bash
# 1. Install Supabase CLI
brew install supabase/tap/supabase

# 2. Start local Supabase (this will download all required Docker images)
supabase start

# 3. Switch to local environment
./scripts/switch-to-local.sh

# 4. Import properties data
node scripts/import-properties-to-local.js
```

**Local Supabase Services:**
- API: http://127.0.0.1:54321
- Database: postgresql://postgres:postgres@127.0.0.1:54322/postgres
- Studio: http://127.0.0.1:54323
- Storage: http://127.0.0.1:54321/storage/v1/s3

See **[Local Supabase Migration Guide](docs/LOCAL_SUPABASE_MIGRATION.md)** for comprehensive setup and troubleshooting.

#### Cloud Supabase Setup (Production)

```bash
# Switch to cloud environment
./scripts/switch-to-cloud.sh
```

### Installation

```bash
# Clone repository
git clone <repository-url>
cd ga4TechIssueCatcher

# Install dependencies
npm install

# Install Playwright browsers
npx playwright install chromium

# Configure environment
cp .env.example .env
# Edit .env with your configuration
```

### Configuration

Edit `.env` file:

```bash
# CSV file path
CSV_PATH=./src/ga4Property/Amore_GA4_PropertList.csv

# Browser pool settings
BROWSER_POOL_SIZE=5
PAGE_TIMEOUT_MS=30000
NETWORK_WAIT_MS=10000

# File retention
RETENTION_DAYS=30

# Web server settings
SERVER_PORT=3000

# Logging
LOG_LEVEL=info
```

### Running the System

#### Option 1: Validation Only

```bash
# Run validation without dashboard
npm start
```

#### Option 2: Web Dashboard + Validation

```bash
# Terminal 1: Start web server
npm run server

# Terminal 2: Run validation (in another terminal)
npm start
```

#### Option 3: Development Mode

```bash
# Start server with auto-restart
npm run dev
```

### Accessing the Dashboard

Open your browser and navigate to:

```
http://localhost:3000
```

## Web Dashboard

### Features

📊 **Summary Cards**
- Total properties validated
- Success/failure counts
- Total issues detected
- Real-time status updates

🔍 **Advanced Filtering**
- Filter by date (view historical results)
- Filter by status (success/failed)
- Search by property or account name

📋 **Results Table**
- Property name and account
- Validation status
- Issue count
- Validation timestamp
- Quick access to details

🔔 **Real-time Updates**
- WebSocket connection status
- Live validation progress
- Automatic dashboard refresh on completion

### Dashboard Screenshots

The dashboard provides a clean, responsive interface for monitoring all validation activities:

- **Header**: Shows connection status and last update time
- **Summary Section**: 4 cards displaying key metrics
- **Filters**: Date selector, status filter, and search box
- **Results Table**: Sortable table with all validation results
- **Detail Modal**: Click "View" to see full property details with screenshot

## API Documentation

### REST API Endpoints

#### Get Server Status
```
GET /api/status
```
Returns server health, latest execution info, and connected clients.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "online",
    "version": "1.0.0",
    "uptime": 3600,
    "latestExecution": "2025-01-15",
    "summary": { ... },
    "connectedClients": 2
  }
}
```

#### Get Available Dates
```
GET /api/dates
```
Returns list of dates with validation results.

**Response:**
```json
{
  "success": true,
  "data": ["2025-01-15", "2025-01-14", "2025-01-13"]
}
```

#### Get Results for Date
```
GET /api/results/:date
```
Returns all validation results for a specific date.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "propertyName": "AMOREMALL KR",
      "accountName": "[GA4] Amorepacific - Ecommerce",
      "slug": "amoremall-kr",
      "isValid": false,
      "issues": [...],
      "validationTime": "2025-01-15T03:05:12.000Z"
    }
  ],
  "count": 100
}
```

#### Get Specific Property Result
```
GET /api/results/:date/:slug
```
Returns detailed validation result for a specific property.

#### Get Summary for Date
```
GET /api/summary/:date
```
Returns execution summary for a specific date.

**Response:**
```json
{
  "success": true,
  "data": {
    "executionTime": "2025-01-15T03:00:00.000Z",
    "totalProperties": 100,
    "successfulValidations": 85,
    "failedValidations": 15,
    "errorCount": 0,
    "validationRate": "85.0",
    "totalExecutionTimeMs": 180000,
    "averageExecutionTimeMs": 1800,
    "issueSummary": { ... }
  }
}
```

#### Get Screenshot
```
GET /api/screenshots/:date/:filename
```
Returns screenshot image file.

### WebSocket Events

Connect to WebSocket:
```javascript
ws://localhost:3000/ws
```

#### Server → Client Events

**validation_started**
```json
{
  "type": "validation_started",
  "data": {
    "executionId": "2025-01-15T03:00:00.000Z",
    "totalProperties": 100,
    "timestamp": "2025-01-15T03:00:00.000Z"
  }
}
```

**property_validated**
```json
{
  "type": "property_validated",
  "data": {
    "propertyName": "AMOREMALL KR",
    "isValid": false,
    "issueCount": 2,
    "progress": "15/100",
    "timestamp": "2025-01-15T03:01:30.000Z"
  }
}
```

**validation_completed**
```json
{
  "type": "validation_completed",
  "data": {
    "summary": { ... },
    "executionTimeMs": 180000,
    "timestamp": "2025-01-15T03:03:00.000Z"
  }
}
```

**connected**
```json
{
  "type": "connected",
  "message": "Connected to GA4 Tech Issue Catcher"
}
```

#### Client → Server Events

**ping** (optional)
```json
{
  "type": "ping"
}
```

Server responds with:
```json
{
  "type": "pong"
}
```

## Project Structure

```
ga4TechIssueCatcher/
├── src/
│   ├── modules/
│   │   ├── csvPropertyManager.js      # CSV loading and parsing
│   │   ├── browserPoolManager.js      # Browser pool management
│   │   ├── networkEventCapturer.js    # CDP network event capture
│   │   ├── configValidator.js         # GA4/GTM validation logic
│   │   ├── resultStorage.js           # Result/screenshot storage
│   │   └── orchestrator.js            # Main workflow coordination
│   ├── ga4Property/
│   │   └── Amore_GA4_PropertList.csv  # Property configuration
│   ├── server.js                       # Express + WebSocket server
│   └── index.js                        # Validation entry point
├── public/
│   ├── index.html                      # Dashboard UI
│   ├── css/
│   │   └── styles.css                  # Dashboard styles
│   └── js/
│       └── app.js                      # Dashboard logic
├── docs/
│   ├── architecture.md                 # System architecture
│   ├── prd.md                          # Product requirements
│   └── prd/                            # Epic-level PRD files
├── results/                            # Validation results (JSON)
├── screenshots/                        # Full-page screenshots
├── logs/                               # Execution logs
└── package.json
```

## Automation Setup

### Cron Job (Daily at 3 AM KST)

**Note**: Ensure the web server is running continuously for dashboard access.

```bash
# Start server as background service (run once)
cd /path/to/ga4TechIssueCatcher
nohup node src/server.js > logs/server.log 2>&1 &

# Add validation cron job
crontab -e

# Add this line for daily validation at 3 AM
0 3 * * * cd /path/to/ga4TechIssueCatcher && /usr/bin/node src/index.js >> logs/cron.log 2>&1
```

### Using PM2 (Recommended for Production)

```bash
# Install PM2 globally
npm install -g pm2

# Start server with PM2
pm2 start src/server.js --name ga4-dashboard

# Save PM2 process list
pm2 save

# Setup PM2 to start on system boot
pm2 startup

# View logs
pm2 logs ga4-dashboard
```

## Validation Logic

### Measurement ID Validation
- Extracts `tid` parameter from `analytics.google.com/g/collect` requests
- Compares against expected Measurement ID from CSV
- Reports critical issue on mismatch

### GTM Container ID Validation
- Extracts `id` parameter from `googletagmanager.com/gtm.js` requests
- Compares against expected Web GTM ID from CSV
- Reports critical issue on mismatch

### page_view Event Validation
- Searches for `en=page_view` in GA4 collect requests
- Reports critical issue if not found within 10 seconds

### AP_DATA Validation (Optional)
- Extracts `ep.AP_DATA` custom parameter
- Validates brand and country fields
- Reports warning if missing or invalid

## Output Files

### Validation Results (`results/YYYY-MM-DD/`)
JSON files containing:
- Property name, account, validation time
- Measurement ID validation result
- GTM ID validation result
- page_view event validation result
- AP_DATA validation result
- Issue list with severity levels
- Screenshot file path

### Screenshots (`screenshots/YYYY-MM-DD/`)
Full-page PNG screenshots for visual evidence and troubleshooting.

### Summary (`results/YYYY-MM-DD/_summary.json`)
Execution summary with:
- Total properties validated
- Success/failure counts
- Issue breakdown by type and severity
- Execution time statistics

## Maintenance

### File Cleanup
The system automatically deletes files older than 30 days (configurable via `RETENTION_DAYS`).

### Manual Cleanup
```bash
# Clean all results and screenshots
rm -rf results/* screenshots/* logs/*
```

### Update Property List
Simply edit the CSV file - no code changes required:
```bash
vi src/ga4Property/Amore_GA4_PropertList.csv
```

### Server Restart
```bash
# If using PM2
pm2 restart ga4-dashboard

# If using nohup
pkill -f "node src/server.js"
nohup node src/server.js > logs/server.log 2>&1 &
```

## Testing and Verification

### Test Migration Setup
```bash
# Run all migration tests with comprehensive reporting
npm run test:full-migration

# Or run individual tests
npm run test:local-connection      # Validate Supabase connectivity
npm run test:screenshot-comparison # Measure compression effectiveness
npm run test:e2e-local            # Full workflow test
```

**Test Reports:**
- HTML: `./test-reports/migration-test-latest.html`
- JSON: `./test-reports/migration-test-{date}.json`

## Troubleshooting

**For comprehensive troubleshooting, see [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)**

### Dashboard Not Loading

**Check server status:**
```bash
# Check if server is running
ps aux | grep "node src/server.js"

# Check server logs
tail -f logs/server.log
```

**Restart server:**
```bash
pm2 restart ga4-dashboard
# or
node src/server.js
```

### WebSocket Connection Failed

**Symptoms**: "Offline" status in dashboard header

**Solutions**:
1. Ensure server is running on correct port (check `.env`)
2. Check firewall settings allow WebSocket connections
3. Verify no proxy blocking WebSocket traffic
4. Check browser console for connection errors

### Local Supabase Issues

**Services won't start:**
```bash
# Check Docker Desktop is running
docker ps

# Stop and restart Supabase
supabase stop
supabase start
```

**Connection errors:**
```bash
# Validate local configuration
node scripts/test-local-connection.js

# Check Supabase status
supabase status
```

### Browser Installation Issues
```bash
# Reinstall Playwright browsers
npx playwright install --force chromium
```

### Permission Issues
```bash
# Fix file permissions
chmod +x src/index.js
chmod 755 results screenshots logs public
```

### Memory Issues
Reduce `BROWSER_POOL_SIZE` in `.env` from 7 to 3.

### Port Already in Use
```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or change SERVER_PORT in .env
```

## Technical Stack

### Backend
- **Runtime**: Node.js 18 LTS
- **Web Framework**: Express.js ^4.18.2
- **WebSocket**: ws ^8.14.2
- **Browser Automation**: Playwright ^1.40.0
- **Network Capture**: Chrome DevTools Protocol (CDP)
- **CSV Parsing**: csv-parse ^5.5.0
- **Environment Config**: dotenv ^16.3.0

### Frontend
- **UI**: Vanilla JavaScript (no framework)
- **Styling**: Modern CSS with CSS Variables
- **Real-time**: WebSocket API
- **HTTP Client**: Fetch API

## Architecture

See [docs/architecture.md](docs/architecture.md) for detailed system architecture.

## Development Roadmap

### Phase 2 (Future Enhancements)
- Winston logging integration
- Retry logic with exponential backoff
- Comprehensive test suite
- Performance monitoring
- User authentication for dashboard
- Export functionality (CSV, Excel)
- Email notifications (optional)
- Historical trend charts

## Migration and Recovery Guides

### Cleanup Schedule Migration
The cleanup scheduler has been migrated from .env to database storage for dynamic configuration management. See:

- **[Cleanup Schedule Migration Guide](./CLEANUP_SCHEDULE_MIGRATION_GUIDE.md)** - Comprehensive migration and recovery procedures
- **[Quick Recovery Guide](./QUICK_RECOVERY_GUIDE.md)** - Emergency 5-minute recovery procedures
- **[Legacy Cleanup Backup](./LEGACY_CLEANUP_BACKUP.md)** - Backup information and change history

**Backup file**: `/Users/seong-won-yeong/Dev/ga4TechIssueCatcher-backup-20251103-140532.tar.gz` (7.9GB)

---

## License

ISC

## Support

For issues or questions, contact the Digital Analytics Team.

---

**Dashboard URL**: http://localhost:3000
**API Base URL**: http://localhost:3000/api
**WebSocket URL**: ws://localhost:3000/ws
