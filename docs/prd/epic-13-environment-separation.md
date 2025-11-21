# Epic 13: Environment-Based Feature Separation - Brownfield Enhancement

## Epic Goal

Separate crawling execution from monitoring dashboard functionality to enable stable deployment on memory-constrained platforms (Render.com 512MB) while maintaining full local development capabilities.

## Epic Description

### Existing System Context

- **Current relevant functionality:** GA4/GTM validation system with Playwright browser automation, Express/React dashboard for real-time monitoring via WebSocket, and Supabase data storage
- **Technology stack:**
  - Backend: Node.js, Express, Playwright, Supabase client, WebSocket
  - Frontend: React, React Router, WebSocket client
  - Deployment: Render.com (512MB memory limit), Cloudflare Tunnel for Supabase connectivity
- **Integration points:**
  - Server startup (`src/server.js`) initializes schedulers and recovery
  - Crawl API routes (`src/routes/crawl.js`) handle start/stop operations
  - Dashboard (`front/crawler-monitor/src/pages/Dashboard.js`) provides UI controls
  - Cleanup/Retry schedulers run on server initialization

### Enhancement Details

- **What's being added/changed:**
  - Automatic Render environment detection (via `RENDER` env var)
  - Conditional feature activation based on environment
  - Frontend UI adaptation for read-only vs full-feature modes
  - Scheduler conditional initialization
  - Environment information API endpoint

- **How it integrates:**
  - Environment detection utility (`src/utils/environment.js`) provides centralized logic
  - Backend routes check environment before allowing crawl operations
  - Frontend fetches environment info and conditionally renders UI
  - Schedulers check environment before starting crawl-related tasks
  - No changes to core validation logic or data models

- **Success criteria:**
  - ✅ Render deployment stable with <100MB memory usage (no browser processes)
  - ✅ Local environment retains full crawling functionality
  - ✅ Zero manual configuration required for environment detection
  - ✅ Clear user feedback when features are disabled
  - ✅ No regression in existing crawl or dashboard functionality

## Stories

### Story 13.1: Backend Environment Detection & API Protection

**Goal:** Implement automatic environment detection and protect crawl execution APIs

**Scope:**
- Create `src/utils/environment.js` with detection logic
- Add environment check to crawl start endpoint
- Create `/api/environment` endpoint
- Update `/api/crawl/status` to include crawl availability

**Acceptance Criteria:**
- Render environment auto-detected via `RENDER=true`
- Manual override available via `DISABLE_CRAWL_START`
- Crawl start returns 403 with clear message when disabled
- Environment info accessible via API

### Story 13.2: Frontend UI Adaptation & User Communication

**Goal:** Adapt dashboard UI based on environment capabilities

**Scope:**
- Fetch environment info on Dashboard mount
- Hide/show crawl controls based on environment
- Display informational banner for read-only mode
- Update error handling for disabled features

**Acceptance Criteria:**
- Crawl button hidden on Render deployment
- "Read-only Dashboard" banner displayed when appropriate
- Korean warning toast for disabled crawl attempts
- Local environment shows full UI unchanged

### Story 13.3: Scheduler Conditional Execution & Documentation

**Goal:** Prevent unnecessary scheduler initialization and document environment configuration

**Scope:**
- Add environment check to retry scheduler startup
- Keep cleanup scheduler active (data management)
- Update CLAUDE.md with environment sections
- Create deployment guide with configuration details

**Acceptance Criteria:**
- Retry scheduler disabled on Render (crawl-related)
- Cleanup scheduler runs on all environments
- Documentation clearly explains local vs Render setup
- Environment variables documented with examples

## Compatibility Requirements

- [x] **Existing APIs remain unchanged** - Only adding environment info, crawl API returns appropriate status
- [x] **Database schema changes are backward compatible** - No database changes
- [x] **UI changes follow existing patterns** - Uses existing toast system and Dashboard layout
- [x] **Performance impact is minimal** - Single environment check on startup, negligible overhead

## Risk Mitigation

### Primary Risk
Accidental crawl execution on Render causing memory crashes and service instability

### Mitigation
- Multi-layered protection:
  1. Automatic environment detection (primary)
  2. Manual override flag (backup)
  3. Frontend UI prevention (UX layer)
  4. API-level blocking (enforcement layer)

### Rollback Plan
- Remove environment detection logic
- Set `DISABLE_CRAWL_START=false` on Render
- Revert frontend changes
- Re-enable all schedulers
- All changes are additive, original code paths remain intact

## Definition of Done

- [x] **Story 13.1 completed** - Backend environment detection and API protection working
- [x] **Story 13.2 completed** - Frontend adapts correctly to environment
- [x] **Story 13.3 completed** - Schedulers respect environment, documentation updated
- [x] **Existing functionality verified** - Local crawling works, dashboard displays results
- [x] **Integration points working** - WebSocket, API endpoints, Supabase connectivity intact
- [x] **Documentation updated** - CLAUDE.md reflects environment configuration
- [x] **No regression** - All existing tests pass, no degradation in performance

## Validation Checklist

### Scope Validation
- [x] Epic can be completed in 3 stories maximum
- [x] No architectural documentation required (follows existing patterns)
- [x] Enhancement follows existing patterns (environment variable pattern, API structure)
- [x] Integration complexity manageable (isolated changes, clear boundaries)

### Risk Assessment
- [x] Risk to existing system is low (additive changes, multiple safety layers)
- [x] Rollback plan is feasible (remove environment checks, restore defaults)
- [x] Testing approach covers existing functionality (manual testing of crawl + dashboard)
- [x] Team has sufficient knowledge of integration points (clear documentation in CLAUDE.md)

### Completeness Check
- [x] Epic goal is clear and achievable (environment separation for deployment stability)
- [x] Stories are properly scoped (backend → frontend → docs progression)
- [x] Success criteria are measurable (memory usage, functionality retention)
- [x] Dependencies are identified (Story 1.1 → 1.2 → 1.3 sequence)

---

## Story Manager Handoff

Please develop detailed user stories for this brownfield epic. Key considerations:

- This is an enhancement to an existing system running **Node.js/Express backend with React frontend, deployed on Render.com with 512MB memory constraint**
- Integration points:
  - `src/server.js` - Server initialization and scheduler startup
  - `src/routes/crawl.js` - Crawl execution API endpoints
  - `front/crawler-monitor/src/pages/Dashboard.js` - Main UI component
  - Environment variables (`RENDER`, `DISABLE_CRAWL_START`)
- Existing patterns to follow:
  - Express route structure with success/error responses
  - React functional components with hooks
  - Supabase client API patterns
  - WebSocket real-time updates
- Critical compatibility requirements:
  - No changes to validation logic or data models
  - Maintain WebSocket connectivity
  - Preserve all existing API endpoints and responses
  - Keep local development workflow intact
- Each story must include verification that existing functionality remains intact (crawling on local, dashboard displays historical data)

The epic should maintain system integrity while delivering **stable Render deployment (read-only dashboard) and full local development capabilities (crawling + monitoring)**.
