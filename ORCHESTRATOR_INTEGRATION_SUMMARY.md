# 🔍 Orchestrator Batch Upload Integration - Discovery Report

## 📊 Current State Analysis

### Problem Identified
**User reported**: Screenshots not appearing in dashboard despite successful test scripts.

**Root cause found**:
- ✅ Test scripts (`scripts/test-batch-upload.js`) use **batch upload** successfully
- ❌ Real orchestrator (`src/modules/orchestrator.js`) still uses **old direct-save approach**
- ❌ Screenshots saved to local disk (`saveScreenshot`) instead of memory buffers
- ❌ Results immediately inserted to Supabase (not batched)

**Evidence**:
```sql
-- Query result shows NULL screenshot URLs in real crawl results
SELECT screenshot_url, permanent_screenshot_url FROM crawl_results;
-- Result: Both fields are NULL
```

## 🔧 Integration Architecture

### Current Flow (Old Approach - Line 1108-1612)
```
validateSingleProperty()
├── Navigate to page
├── Capture screenshot → saveScreenshot() → Write to disk
├── Validate GA4/GTM
├── Save result → saveValidationResult() → Write JSON
└── INSERT to Supabase → Individual INSERT per property
```

**Problems**:
- Local file storage (screenshots folder)
- Individual Supabase calls (100 properties = 200 network requests)
- No batch upload
- No Supabase Storage integration

### Target Flow (Batch Approach)
```
validateSingleProperty()
├── Navigate to page
├── Capture screenshot → page.screenshot() → Buffer in memory
├── Validate GA4/GTM
├── Store in temp cache → tempCache.addResult() + tempCache.addScreenshot()
└── (No Supabase yet - batch later)

After all validations:
batchUploadCachedResults()
├── Get cached data
├── Batch INSERT results (50 per batch) → 100 properties = 2 calls
├── Batch UPLOAD screenshots (5 per batch) → 100 properties = 20 calls
└── Update crawl_runs with stats
```

**Benefits**:
- Memory-efficient (no local files)
- Network-efficient (98% reduction in HTTP calls)
- Supabase Storage URLs (screenshot_url field populated)
- Automatic cleanup (TTL-based)

## 📂 Files Requiring Changes

### 1. `src/modules/orchestrator.js` (MAIN FILE)

#### A. Add Imports (Line 13)
```javascript
import { getTempCache } from './tempCacheManager.js';
import BatchUploadManager from './batchUploadManager.js';
```

#### B. Initialize Temp Cache in `runValidation()` (Line 874-916)
```javascript
export async function runValidation(config) {
  // ... existing code ...

  const tempCache = getTempCache();
  await tempCache.initialize();  // ADD THIS

  try {
    // ... existing validation logic ...
  } finally {
    await tempCache.clear();  // ADD THIS
  }
}
```

#### C. Modify `validateSingleProperty()` (Line 1108-1612)

**Key changes**:
1. **Screenshot as buffer** (instead of saveScreenshot):
```javascript
// OLD:
const screenshotPath = await saveScreenshot(page, property.slug, dateStr);

// NEW:
const screenshotBuffer = await page.screenshot({ fullPage: true, type: 'png' });
await tempCache.addScreenshot(property._supabaseId || property.slug, screenshotBuffer, {
  propertyName: property.propertyName,
  url: property.representativeUrl
});
```

2. **Store result in cache** (instead of saveValidationResult + Supabase INSERT):
```javascript
// OLD:
await saveValidationResult(result, dateStr);
await supabase.from(Tables.CRAWL_RESULTS).insert(insertData);

// NEW:
await tempCache.addResult(result, property._supabaseId || property.slug);
```

#### D. Add Batch Upload After Validation (Line 1004-1010)
```javascript
// After runParallelValidation completes:
const { results, errors } = await runParallelValidation(...);

// ADD THIS:
console.log('\n📤 Batch uploading results to Supabase...\n');
const batchUploader = new BatchUploadManager();
const cacheData = tempCache.getAllData();
const uploadSummary = await batchUploader.uploadAll(currentRunId, cacheData);

// Update crawl_runs with upload stats:
await supabase.from(Tables.CRAWL_RUNS).update({
  upload_completed_at: new Date().toISOString(),
  upload_duration_ms: uploadSummary.duration,
  upload_success_count: uploadSummary.results.success + uploadSummary.screenshots.success,
  upload_failed_count: uploadSummary.results.failed + uploadSummary.screenshots.failed
}).eq('id', currentRunId);
```

### 2. Environment Variables (`.env`)
```bash
# Already configured from previous work:
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
LOCAL_BACKUP_ENABLED=false  # Disable local file backup
```

## 🧪 Testing Strategy

### Phase 1: Verify Integration (5-10 properties)
```bash
# 1. Start server
npm run server

# 2. Trigger crawl via dashboard (test with 5-10 properties)

# 3. Check logs for:
# - "📦 Initializing temp cache..."
# - "📸 Screenshot buffer captured (X.XXMB)"
# - "💾 Stored result in cache for {property}"
# - "📤 Batch uploading results to Supabase..."
# - "✅ Uploaded 10/10 results"
# - "✅ Uploaded 10/10 screenshots"

# 4. Verify in Supabase:
# - crawl_results table: screenshot_url populated
# - screenshots bucket: files uploaded
# - crawl_runs table: upload_* fields populated
```

### Phase 2: Full Property Set Test
```bash
# Run full crawl and verify:
# - No local screenshots folder created
# - All screenshot URLs in database
# - Dashboard shows screenshots correctly
```

## 📊 Expected Performance Improvements

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Network Calls (100 props) | 200 (100 results + 100 screenshots) | 22 (2 batch results + 20 batch screenshots) | **89% ↓** |
| Screenshot Storage | Local disk (500MB) | Supabase Storage + Memory cache | **Zero local files** |
| Upload Time | ~10s (individual calls) | ~1.5s (batch calls) | **85% ↓** |
| Memory Usage | Low (disk-based) | Moderate (cache + buffers) | **Acceptable** |

## ⚠️ Risk Assessment

### Low Risk (Reversible)
- All changes are additive (no file deletions)
- Old saveScreenshot function kept for backward compatibility
- Feature can be toggled via environment variable if needed

### Mitigation Strategy
1. **Rollback plan**: Keep old code commented out for 1-2 weeks
2. **Feature flag**: `ENABLE_BATCH_UPLOAD=true` (optional)
3. **Dual write**: Can run both approaches in parallel during transition

## 🎯 Next Steps

1. **Implement changes** in orchestrator.js
2. **Test with 5 properties** via dashboard
3. **Verify screenshots appear** in dashboard
4. **Run full crawl** with all properties
5. **Document completion** and update architecture docs

---

**Status**: Ready for implementation
**Estimated time**: 20-30 minutes
**Priority**: High (blocking user's screenshot visibility)
**Confidence**: High (test scripts prove system works)
