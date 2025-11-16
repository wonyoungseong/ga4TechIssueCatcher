# Phase 2 Investigation Summary

## User Question
"31ebd71c-06ff-4d9c-94c6-03b76869a940 에서 https://vn.sulwhasoo.com/가 실패라고하는데 왜 실패한건지 알고싶습니다."
Translation: "Why did https://vn.sulwhasoo.com/ fail in run ID 31ebd71c-06ff-4d9c-94c6-03b76869a940?"

Follow-up: "phase2는 80초로 되어있는데 이슈가 무엇인가요?"
Translation: "Phase 2 is set to 80 seconds, what's the issue?"

## Findings

### ✅ Immediate Answer: Why SULWHASOO VN Failed
**Property**: [EC] SULWHASOO - VN
**URL**: https://vn.sulwhasoo.com/
**Error**: "Validation failed after retries: page.goto: Timeout 10000ms exceeded."
**Issue Type**: VALIDATION_ERROR

**Root Cause**: The website took longer than 10 seconds to load, causing a page navigation timeout.

### 🚨 CRITICAL DISCOVERY: Phase 2 Never Executed

**Run Statistics**:
- Run ID: 31ebd71c-06ff-4d9c-94c6-03b76869a940
- Total Properties: 111
- Phase 1 Results: 111
- **Phase 2 Results: 0 ❌**
- Timeout-Related Failures: 75

**The Problem**: 75 properties failed with timeout errors in Phase 1, but Phase 2 (which has an 80-second timeout) was never executed to retry them.

## Investigation Process

### Step 1: Verified Phase 2 Settings
- Phase 1 Timeout: 10 seconds ✅
- Phase 2 Timeout: 80 seconds ✅
- Settings correctly stored in database

### Step 2: Examined Timeout Detection Logic
**Location**: `src/modules/orchestrator.js:575-590`

```javascript
const isTimeout = error.message.toLowerCase().includes('timeout') ||
                 error.message === 'TIMEOUT_EXCEEDED';

if (isTimeout) {
  console.log(`   ⏱️ Timeout (${phase1Timeout / 1000}s) - Queued for Phase 2`);
  timeoutExceededProperties.push(property);  // Should queue for Phase 2
}
```

**Finding**: Logic appears correct - timeout errors should be queued for Phase 2.

### Step 3: Analyzed Error Message Format
**Database Query Result**:
```
issue_summary: "Validation failed after retries: page.goto: Timeout 10000ms exceeded."
```

**Finding**: Error message is wrapped by `validateSingleProperty` function (line 2053):
```javascript
message: `Validation failed after retries: ${error.message}`
```

However, the original error is re-thrown correctly (line 2082):
```javascript
throw error;  // Re-throws original error, not wrapped version
```

### Step 4: Diagnostic Script Results
Created `diagnose-phase2-issue.js` and confirmed:
- 111 total results
- 111 in Phase 1
- 0 in Phase 2 ❌
- 75 timeout-related failures that should have been queued for Phase 2

## Current Status

**Confirmed**:
1. ✅ Settings are correct (Phase 2 = 80 seconds)
2. ✅ Timeout detection logic is correct
3. ✅ 75 properties failed with timeouts
4. ❌ Phase 2 was never executed despite having 75 queued properties

**Remaining Mystery**:
Why didn't Phase 2 execute when `timeoutExceededProperties.length = 75`?

The code at line 790 should trigger Phase 2:
```javascript
if (timeoutExceededProperties.length > 0) {
  // Execute Phase 2
}
```

## Next Steps

Need to investigate:
1. Check if there's a stop condition before Phase 2
2. Check if server was restarted during Phase 1 (which would clear the in-memory `timeoutExceededProperties` array)
3. Check if there's any code path that skips Phase 2 execution
4. Add logging to track `timeoutExceededProperties` array size at the end of Phase 1

## 🎯 ROOT CAUSE IDENTIFIED

**Finding**: Server was restarted/stopped between Phase 1 completion and Phase 2 execution.

**Evidence**:
1. All code logic is correct - timeout detection, queueing, Phase 2 execution condition
2. Run 31ebd71c-06ff-4d9c-94c6-03b76869a940 had initial statistics of 0 (indicating interrupted execution)
3. Startup recovery system found 22 incomplete runs, including this one
4. `timeoutExceededProperties` is an in-memory array - cleared on server restart

**Code Flow Verification**:
```javascript
orchestrator.js:518  → validateSingleProperty(browser, property, dateStr, 1, ...)  // Phase 1
orchestrator.js:1988 → retryWithBackoff(..., phase)  // Pass phase parameter
orchestrator.js:166  → return false;  // Timeout errors are non-retryable
orchestrator.js:233  → throw error;  // Throw immediately without retry
orchestrator.js:2082 → throw error;  // Re-throw from validateSingleProperty
orchestrator.js:590  → timeoutExceededProperties.push(property);  // Queue for Phase 2
orchestrator.js:790  → if (timeoutExceededProperties.length > 0) { ... }  // Execute Phase 2
```

**Why Phase 2 Didn't Run**:
- Phase 1 completed, 75 properties queued in `timeoutExceededProperties`
- Server was restarted (possibly manual restart, crash, or system restart)
- In-memory `timeoutExceededProperties` array was cleared
- Phase 2 never executed because the queue was empty after restart
- Startup recovery fixed database statistics but couldn't recover the Phase 2 queue

## Implications

This is NOT a code bug - it's an operational issue:
- The 2-phase timeout system works correctly when the server stays running
- Server restarts between Phase 1 and Phase 2 cause Phase 2 to be skipped
- The startup recovery system fixes database statistics but cannot recover the Phase 2 queue
- Properties that timeout in Phase 1 are marked as failed instead of being retried with Phase 2's 80-second timeout

## 💡 Solution Options

### Option 1: Persist Phase 2 Queue to Database (Recommended)
**Approach**: Store timeout properties in database during Phase 1
```javascript
// When property times out in Phase 1:
await supabase
  .from('crawl_results')
  .insert({
    crawl_run_id: runId,
    property_id: property.id,
    phase: 1,
    validation_status: 'timeout',
    queued_for_phase2: true  // NEW FLAG
  });

// At startup or Phase 2 execution:
const { data: phase2Queue } = await supabase
  .from('crawl_results')
  .select('*, properties(*)')
  .eq('crawl_run_id', runId)
  .eq('queued_for_phase2', true)
  .eq('phase', 1);

if (phase2Queue.length > 0) {
  // Execute Phase 2 with recovered queue
}
```

**Benefits**:
- Survives server restarts
- Phase 2 can run even after restart
- Minimal code changes

### Option 2: Run Phase 2 During Startup Recovery
**Approach**: Enhance startup recovery to detect and execute missing Phase 2
```javascript
// In startupRecovery.js:
const timeoutResults = results.filter(r =>
  r.issue_summary?.toLowerCase().includes('timeout') &&
  r.phase === 1
);

if (timeoutResults.length > 0) {
  console.log(`  🔄 Found ${timeoutResults.length} Phase 1 timeouts - executing Phase 2...`);
  // Execute Phase 2 re-validation with 80s timeout
}
```

**Benefits**:
- Automatic recovery
- No database schema changes
- Retroactive fix for existing incomplete runs

### Option 3: Make Crawls Atomic
**Approach**: Don't allow server restarts during crawls
```javascript
// Add graceful shutdown handling:
process.on('SIGTERM', async () => {
  if (crawlInProgress) {
    console.log('⏸️ Crawl in progress - waiting for completion...');
    await waitForCrawlCompletion();
  }
  process.exit(0);
});
```

**Benefits**:
- Prevents data loss
- No code changes to 2-phase system

**Drawbacks**:
- Can't force-restart during long crawls
- Not protection against crashes

## Recommended Implementation

**Combine Option 1 + Option 2**:
1. Persist Phase 2 queue to database (prevents future issues)
2. Enhance startup recovery to handle existing incomplete Phase 2s (fixes historical data)

This provides both forward and backward compatibility.
