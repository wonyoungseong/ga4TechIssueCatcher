# 🔧 Orchestrator Integration Plan

## 📋 Current State Analysis

### ✅ What Works
- Test scripts use batch upload successfully (100% upload rate)
- Temp cache manager operational
- Batch upload manager functional
- Supabase Storage bucket created
- Database migration applied

### ❌ What's Missing
- **Real orchestrator still uses old approach** (lines 1472-1534 in orchestrator.js)
- Screenshots saved to local disk instead of memory buffer
- Results inserted to Supabase immediately (not batched)
- No integration with temp cache system

## 🎯 Integration Tasks

### Task 1: Modify orchestrator.js to use temp cache
**File**: `src/modules/orchestrator.js`
**Lines to modify**: 1108-1612 (validateSingleProperty function)

**Changes needed**:
1. Import temp cache and batch upload managers
2. Capture screenshots as buffers (not save to disk)
3. Store results in temp cache (not Supabase)
4. Remove immediate Supabase INSERT calls

### Task 2: Add batch upload after crawl completion
**File**: `src/modules/orchestrator.js`
**Lines to modify**: 1004-1010 (after runParallelValidation)

**Changes needed**:
1. After validation completes, call batch upload
2. Update crawl_runs with upload statistics
3. Handle upload errors gracefully

### Task 3: Initialize temp cache at crawl start
**File**: `src/modules/orchestrator.js`
**Lines to modify**: 874-916 (runValidation function)

**Changes needed**:
1. Initialize temp cache before validation
2. Clear cache after batch upload
3. Add error handling for cache operations

### Task 4: Update result storage module
**File**: `src/modules/resultStorage.js`

**Changes needed**:
1. Modify saveScreenshot to return buffer instead of saving to disk
2. Keep backward compatibility for local backups (optional)

## 🔄 Implementation Strategy

### Phase 1: Minimal Changes (Low Risk)
- Keep existing code structure
- Add temp cache alongside current approach
- Dual write: temp cache + old approach
- Verify both work in parallel

### Phase 2: Switch to Batch Upload (Medium Risk)
- Disable immediate Supabase writes
- Enable batch upload after crawl
- Test with small property set

### Phase 3: Cleanup (Low Risk)
- Remove old code paths
- Update documentation
- Performance optimization

## 📊 Verification Steps

1. **Temp Cache Test**
   ```bash
   npm run test:cache
   ```

2. **Batch Upload Test**
   ```bash
   npm run test:upload
   ```

3. **Real Crawl Test**
   - Start server: `npm run server`
   - Trigger crawl via dashboard
   - Check screenshot URLs in results
   - Verify Supabase Storage uploads

4. **Database Verification**
   ```sql
   -- Check screenshot URLs are populated
   SELECT
     property_id,
     screenshot_url,
     permanent_screenshot_url
   FROM crawl_results
   ORDER BY created_at DESC
   LIMIT 10;
   ```

## ⚠️ Risk Mitigation

### Rollback Plan
- Keep old code commented out
- Feature flag for batch upload: `ENABLE_BATCH_UPLOAD=true`
- Fallback to old approach if batch upload fails

### Testing Checklist
- [ ] Screenshots appear in dashboard
- [ ] Screenshot URLs in database
- [ ] Supabase Storage contains files
- [ ] Upload statistics in crawl_runs
- [ ] Memory usage acceptable
- [ ] No file leaks

## 🚀 Next Steps

1. **Implement Phase 1** (Dual Write)
   - Add temp cache initialization
   - Store screenshots in both cache and disk
   - Verify cache works alongside old approach

2. **Test with Real Crawl**
   - Run small test (5-10 properties)
   - Check logs for cache operations
   - Verify uploads work

3. **Implement Phase 2** (Switch to Batch)
   - Disable old Supabase writes
   - Enable batch upload
   - Test with full property set

4. **Cleanup & Document**
   - Remove old code
   - Update architecture docs
   - Performance benchmarking

---

**Estimated Time**: 30-45 minutes
**Risk Level**: Low (reversible changes)
**Priority**: High (blocks screenshot display)
