import { chromium } from 'playwright';
import { startCapturing, waitForGA4Events } from './src/modules/networkEventCapturer.js';
import { validateProperty } from './src/modules/configValidator.js';

/**
 * Test Phase 2 timeout behavior for Innisfree
 *
 * Expected behavior:
 * - Phase 1 (40s): Should timeout because page_view fires at 42.7s
 * - Phase 2 (80s): Should successfully detect page_view at 42.7s
 */

const TEST_SITE = {
  name: 'Innisfree KR',
  url: 'https://www.innisfree.com/kr/ko/',
  expectedPageViewTime: 42700 // 42.7 seconds in ms
};

async function testPhase1(url, timeout) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📍 PHASE 1: Fast validation (${timeout / 1000}s timeout)`);
  console.log('='.repeat(80));

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  });
  const page = await context.newPage();

  try {
    // Start capturing
    console.log('📡 Starting network event capture...');
    const capturedEvents = await startCapturing(page);

    // Navigate
    console.log(`🌐 Navigating to ${url}...`);
    const navigationPromise = page.goto(url, {
      timeout: 60000,
      waitUntil: 'domcontentloaded'
    });

    await navigationPromise;
    console.log('✅ Page loaded successfully');

    // Wait for GA4 events with Phase 1 timeout
    console.log(`⏳ Waiting for GA4 events (${timeout / 1000}s timeout)...`);
    const startTime = Date.now();

    const result = await waitForGA4Events(page, capturedEvents, undefined, timeout);
    const elapsedTime = Date.now() - startTime;
    const events = result.events || capturedEvents;

    console.log(`\n📊 Phase 1 Result:`);
    console.log(`   Elapsed Time: ${(elapsedTime / 1000).toFixed(1)}s`);
    console.log(`   GA4 Events Captured: ${events.length}`);

    // Check all possible event name fields
    const pageViewEvents = events.filter(e =>
      e.event_name === 'page_view' ||
      e.eventName === 'page_view' ||
      (e.params && e.params.event_name === 'page_view') ||
      (e.params && e.params.en === 'page_view')  // GA4 uses 'en' parameter
    );
    console.log(`   page_view Events: ${pageViewEvents.length}`);

    // Check if we timed out
    const timedOut = elapsedTime >= timeout;

    if (timedOut && pageViewEvents.length === 0) {
      console.log(`\n⏱️  Phase 1 TIMEOUT - No page_view detected within ${timeout / 1000}s`);
      console.log(`   ℹ️  This property should be queued for Phase 2`);
      return {
        success: false,
        timedOut: true,
        events: events,
        elapsedTime: elapsedTime
      };
    } else if (pageViewEvents.length > 0) {
      console.log(`\n✅ Phase 1 SUCCESS - page_view detected within ${timeout / 1000}s`);
      return {
        success: true,
        timedOut: false,
        events: events,
        elapsedTime: elapsedTime
      };
    } else {
      console.log(`\n❌ Phase 1 FAILED - No page_view detected after ${timeout / 1000}s`);
      return {
        success: false,
        timedOut: false,
        events: events,
        elapsedTime: elapsedTime
      };
    }

  } catch (error) {
    console.error(`\n❌ Phase 1 Error:`, error.message);
    return {
      success: false,
      timedOut: false,
      error: error.message
    };
  } finally {
    await context.close();
    await browser.close();
  }
}

async function testPhase2(url, timeout) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📍 PHASE 2: Slow property re-validation (${timeout / 1000}s timeout)`);
  console.log('='.repeat(80));

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  });
  const page = await context.newPage();

  try {
    // Start capturing
    console.log('📡 Starting network event capture...');
    const capturedEvents = await startCapturing(page);

    // Navigate
    console.log(`🌐 Navigating to ${url}...`);
    const navigationPromise = page.goto(url, {
      timeout: 90000,
      waitUntil: 'domcontentloaded'
    });

    await navigationPromise;
    console.log('✅ Page loaded successfully');

    // Wait for GA4 events with Phase 2 timeout
    console.log(`⏳ Waiting for GA4 events (${timeout / 1000}s timeout)...`);
    const startTime = Date.now();

    const result = await waitForGA4Events(page, capturedEvents, undefined, timeout);
    const elapsedTime = Date.now() - startTime;
    const events = result.events || capturedEvents;

    console.log(`\n📊 Phase 2 Result:`);
    console.log(`   Elapsed Time: ${(elapsedTime / 1000).toFixed(1)}s`);
    console.log(`   GA4 Events Captured: ${events.length}`);

    // Check all possible event name fields
    const pageViewEvents = events.filter(e =>
      e.event_name === 'page_view' ||
      e.eventName === 'page_view' ||
      (e.params && e.params.event_name === 'page_view') ||
      (e.params && e.params.en === 'page_view')  // GA4 uses 'en' parameter
    );
    console.log(`   page_view Events: ${pageViewEvents.length}`);

    if (events.length > 0) {
      console.log(`\n📋 Event Summary:`);
      const eventCounts = {};
      events.forEach(e => {
        const eventName = e.event_name || e.eventName || (e.params?.event_name) || (e.params?.en) || 'unknown';
        eventCounts[eventName] = (eventCounts[eventName] || 0) + 1;
      });
      Object.entries(eventCounts).forEach(([name, count]) => {
        console.log(`   ${name}: ${count}`);
      });

      // Debug: Show event structure
      console.log(`\n🔍 Debug - Sample Event Structures:`);
      events.slice(0, 3).forEach((event, idx) => {
        console.log(`\nEvent ${idx + 1}:`);
        console.log(`  Type: ${event.type}`);
        console.log(`  event_name: ${event.event_name || 'undefined'}`);
        console.log(`  eventName: ${event.eventName || 'undefined'}`);
        console.log(`  params.en: ${event.params?.en || 'undefined'}`);
        console.log(`  params.event_name: ${event.params?.event_name || 'undefined'}`);
      });
    }

    if (pageViewEvents.length > 0) {
      console.log(`\n✅ Phase 2 SUCCESS - page_view detected within ${timeout / 1000}s`);
      console.log(`   ℹ️  This proves Phase 2 should catch late-firing page_view events`);

      // Run validation
      const property = {
        name: TEST_SITE.name,
        url: TEST_SITE.url,
        measurementId: 'G-PKG8ZN03QW',
        hasConsentMode: false
      };

      const validationResult = validateProperty(property, events);
      console.log(`\n🔍 Validation Result:`);
      console.log(`   Is Valid: ${validationResult.isValid}`);
      console.log(`   Severity: ${validationResult.severity}`);

      if (validationResult.issues && validationResult.issues.length > 0) {
        console.log(`   Issues (${validationResult.issues.length}):`);
        validationResult.issues.forEach((issue, i) => {
          console.log(`      ${i + 1}. ${issue}`);
        });
      } else {
        console.log(`   ✅ No issues found`);
      }

      return {
        success: true,
        events: events,
        elapsedTime: elapsedTime,
        validation: validationResult
      };
    } else {
      console.log(`\n❌ Phase 2 FAILED - No page_view detected even with ${timeout / 1000}s timeout`);
      console.log(`   ⚠️  This indicates a problem with the page or detection logic`);
      return {
        success: false,
        events: events,
        elapsedTime: elapsedTime
      };
    }

  } catch (error) {
    console.error(`\n❌ Phase 2 Error:`, error.message);
    return {
      success: false,
      error: error.message
    };
  } finally {
    await context.close();
    await browser.close();
  }
}

async function runTest() {
  console.log('\n🧪 Testing 2-Phase Timeout System');
  console.log('='.repeat(80));
  console.log(`Site: ${TEST_SITE.name}`);
  console.log(`URL: ${TEST_SITE.url}`);
  console.log(`Expected page_view timing: ~${TEST_SITE.expectedPageViewTime / 1000}s`);
  console.log(`Phase 1 Timeout: 10s (intentionally short to force Phase 2)`);
  console.log(`Phase 2 Timeout: 80s`);
  console.log('='.repeat(80));

  // Test Phase 1 with 10 second timeout (intentionally short)
  const phase1Result = await testPhase1(TEST_SITE.url, 10000);

  // If Phase 1 timed out, test Phase 2
  if (phase1Result.timedOut) {
    console.log(`\n${'='.repeat(80)}`);
    console.log('⚠️  Phase 1 timed out - Proceeding to Phase 2 (as expected)');
    console.log('='.repeat(80));

    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds

    const phase2Result = await testPhase2(TEST_SITE.url, 80000);

    // Final summary
    console.log(`\n${'='.repeat(80)}`);
    console.log('📋 FINAL SUMMARY');
    console.log('='.repeat(80));
    console.log(`Phase 1 (10s): ${phase1Result.timedOut ? 'TIMEOUT ⏱️' : phase1Result.success ? 'SUCCESS ✅' : 'FAILED ❌'}`);
    console.log(`Phase 2 (80s): ${phase2Result.success ? 'SUCCESS ✅' : 'FAILED ❌'}`);

    if (phase1Result.timedOut && phase2Result.success) {
      console.log(`\n✅ 2-Phase System Working Correctly:`);
      console.log(`   - Phase 1 timed out at 10s (intentionally short)`);
      console.log(`   - Phase 2 successfully detected page_view within 80s`);
      console.log(`   - This proves the system SHOULD catch Innisfree's late page_view`);
    } else if (phase1Result.timedOut && !phase2Result.success) {
      console.log(`\n❌ 2-Phase System Problem Identified:`);
      console.log(`   - Phase 1 timed out as expected`);
      console.log(`   - Phase 2 FAILED to detect page_view even with 80s timeout`);
      console.log(`   - This could explain why Innisfree was reported as missing page_view`);
    } else {
      console.log(`\n⚠️  Unexpected Result - Review test output above`);
    }

  } else if (phase1Result.success) {
    console.log(`\n${'='.repeat(80)}`);
    console.log('✅ Phase 1 Success - Phase 2 not needed');
    console.log('='.repeat(80));
    console.log(`   page_view was detected within Phase 1's 10s timeout`);
    console.log(`   This is unexpected - page_view should fire at ~42.7s`);
  } else {
    console.log(`\n${'='.repeat(80)}`);
    console.log('❌ Test Failed');
    console.log('='.repeat(80));
    console.log(`   Phase 1 failed (not timeout, but error or no events)`);
  }

  console.log(`\n${'='.repeat(80)}\n`);
}

runTest()
  .then(() => {
    console.log('✅ Test completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
