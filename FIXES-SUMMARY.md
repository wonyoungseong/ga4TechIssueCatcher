# Missing Properties Fix Summary

## Problem Analysis

### Issue 1: CSV Properties Using Slug Instead of UUID
**Root Cause**: When properties are loaded from CSV, they lack the `_supabaseId` field. The code falls back to using `slug` (string like "ec-aestura-kr") as `propertyId`, which causes batch upload to fail because Supabase expects UUID format.

**Evidence**:
- Batch upload logs showed: `Run ID: undefined`
- Database errors: `invalid input syntax for type uuid: "ec-aestura-kr"`
- CSV loader (csvPropertyManager.js) only sets basic fields, not `_supabaseId`

**Impact**: All CSV-based crawls would fail to upload results to database

### Issue 2: Missing Property (옴니회원플랫폼) from Run 274d6c26
**Root Cause**: Unable to determine exact cause due to missing logs for that specific run

**Contributing Factors**:
- Extremely long URL (>1000 characters) might cause processing issues
- Potential cache storage failure with no error logging
- Property processed but result never made it to database

**Evidence**:
- Run 274d6c26: Expected 82 properties, got 81 results
- Property exists in database with very long URL
- Backend logs from different run show the property was processed with ERR_ABORTED errors

## Fixes Implemented

### Fix 1: CSV Property Enrichment with Supabase IDs
**Location**: `src/modules/orchestrator.js` lines 1170-1202

**Implementation**:
```javascript
// After loading CSV properties, enrich them with _supabaseId from database
const { data: dbProperties } = await supabase
  .from(Tables.PROPERTIES)
  .select('id, slug, expected_ga4_id')
  .eq('is_active', true);

// Create lookup maps: slug -> UUID and measurementId -> UUID
const slugToIdMap = new Map(dbProperties.map(p => [p.slug, p.id]));
const measurementIdToIdMap = new Map(dbProperties.map(p => [p.expected_ga4_id, p.id]));

// Enrich properties with _supabaseId
properties = properties.map(prop => {
  let supabaseId = slugToIdMap.get(prop.slug) || measurementIdToIdMap.get(prop.measurementId);
  return supabaseId ? { ...prop, _supabaseId: supabaseId } : prop;
});
```

**Benefits**:
- CSV properties now have proper UUID `_supabaseId`
- Prevents "invalid input syntax for type uuid" errors
- Dual-fallback matching (by slug or measurementId)
- Graceful degradation if database lookup fails

### Fix 2: URL Length Validation
**Location**: `src/modules/orchestrator.js` lines 1434-1438

**Implementation**:
```javascript
// Warn about extremely long URLs that might cause issues
if (url.length > 500) {
  console.log(`   ⚠️ WARNING: URL length is ${url.length} characters (>500)`);
  console.log(`   This may cause issues with some browsers or storage systems.`);
}
```

**Benefits**:
- Early warning for problematic URLs
- Helps diagnose issues with properties like 옴니회원플랫폼

### Fix 3: Enhanced Cache Storage Error Logging
**Location**: `src/modules/orchestrator.js` lines 1943-1957, 2004-2019, 651-664, 973-986

**Implementation**:
```javascript
const propertyId = property._supabaseId || property.slug;
console.log(`     propertyId: ${propertyId} (${property._supabaseId ? 'UUID' : 'slug fallback'})`);

try {
  await tempCache.addResult(result, propertyId);
  console.log(`  ✅ Result stored in cache`);
} catch (cacheError) {
  console.error(`  ❌ Failed to store result in cache:`, cacheError.message);
  logger.error('Cache storage failed', {
    propertyName: property.propertyName,
    propertyId,
    error: cacheError.message,
    phase
  });
}
```

**Benefits**:
- Shows which ID type is being used (UUID vs slug)
- Try-catch prevents cache storage failures from crashing the crawl
- Detailed error logging for debugging
- Applied to all 4 cache storage locations:
  1. Successful validation results
  2. Validation errors (validateSingleProperty catch block)
  3. Phase 1 worker errors
  4. Phase 2 worker errors

## Testing Recommendations

### Test 1: CSV-Based Crawl
1. Start a crawl using CSV properties (if CSV mode is still supported)
2. Verify properties are enriched with `_supabaseId` from database
3. Check that batch upload succeeds without UUID errors
4. Confirm all results are stored in database

### Test 2: Supabase-Based Crawl
1. Start a normal crawl from the web interface
2. Monitor logs for "propertyId: <uuid> (UUID)" messages
3. Verify no "slug fallback" warnings appear
4. Check that 82/82 properties are stored in database

### Test 3: Long URL Property
1. Ensure 옴니회원플랫폼 is in the next crawl
2. Check for URL length warning in logs
3. Verify property processes successfully or fails with clear error
4. Confirm result is stored in database (success or error)

### Test 4: Error Resilience
1. Simulate cache storage failure (corrupt cache directory)
2. Verify error is logged without crashing
3. Check that other properties continue processing

## Expected Outcomes

### Immediate Benefits
- ✅ CSV crawls will now work correctly
- ✅ Clear visibility into which ID type is used for each property
- ✅ Cache storage failures won't crash the crawler
- ✅ Better error logging for debugging

### Long-Term Benefits
- ✅ More reliable data storage
- ✅ Easier troubleshooting with detailed logs
- ✅ Early warning for problematic URLs
- ✅ Better data integrity

## Known Limitations

1. **CSV Mode**: If CSV file has properties not in Supabase database, enrichment will fail for those properties
   - **Mitigation**: Logs warning message and continues with slug

2. **Long URLs**: No automatic handling, only warning
   - **Future**: Could add URL normalization or property URL override feature

3. **Missing Logs**: Cannot diagnose why 옴니회원플랫폼 was missing from run 274d6c26
   - **Mitigation**: Enhanced logging will help diagnose future occurrences

## Rollback Plan

If issues occur:
1. Revert `src/modules/orchestrator.js` to previous version
2. Properties from Supabase will continue working as before
3. CSV mode will revert to using slug (will fail batch upload, but crawler won't crash)

## Next Steps

1. **Deploy fixes** to production server
2. **Run test crawl** and monitor logs carefully
3. **Verify** 82/82 properties are stored successfully
4. **Document** any new issues discovered
5. **Monitor** for "slug fallback" warnings (indicates missing _supabaseId)
