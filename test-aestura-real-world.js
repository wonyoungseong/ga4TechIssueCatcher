/**
 * Real-World Test: AESTURA Property (Consent Mode Active)
 *
 * Story 11.1 Phase 2: AC3 - Validate with AESTURA (Consent Mode)
 *
 * This test validates that window.google_tag_manager extraction works
 * on a real production site with active Consent Mode.
 */

import playwright from 'playwright';
import { startCapturing, waitForGTMLoad } from './src/modules/networkEventCapturer.js';

async function testAesturaRealWorld() {
  console.log('\n🌍 Real-World Test: AESTURA Property (Story 11.1 Phase 2)\n');
  console.log('═'.repeat(70));

  const browser = await playwright.chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  });

  const page = await context.newPage();

  try {
    console.log('\n📋 Test Property Information:');
    console.log('   Site: AESTURA Korea');
    console.log('   URL: https://www.aestura.com/web/main.do');
    console.log('   Expected GTM: GTM-MZH2JRFN');
    console.log('   Expected GA4: G-84NHR3996T');
    console.log('   Consent Mode: ACTIVE (blocks network events until consent)');
    console.log('─'.repeat(70));

    // Navigate to AESTURA site
    console.log('\n🌐 Navigating to AESTURA site...');
    await page.goto('https://www.aestura.com/web/main.do', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    console.log('   ✅ Page loaded');

    // Start capturing events
    const capturedEvents = [];
    await startCapturing(page, capturedEvents);
    console.log('   ✅ Event capture started');

    // Wait for GTM detection (which also extracts GA4 IDs from window)
    console.log('\n⏳ Waiting for GTM detection and window GA4 extraction...');
    const gtmResult = await waitForGTMLoad(page, capturedEvents, 'GTM-MZH2JRFN', 10000);

    console.log('\n📊 Detection Results:');
    console.log(`   GTM Detected: ${gtmResult.gtmDetected}`);
    console.log(`   GTM IDs Found: ${gtmResult.gtmIds.join(', ') || 'None'}`);

    // Analyze captured events
    const ga4Events = capturedEvents.filter(e => e.type === 'ga4_collect');
    const windowExtractedEvents = ga4Events.filter(e => e.source === 'window_extraction');
    const networkEvents = ga4Events.filter(e => e.source !== 'window_extraction');

    console.log(`\n   📡 Total GA4 Events: ${ga4Events.length}`);
    console.log(`   📌 Window-Extracted Events: ${windowExtractedEvents.length}`);
    console.log(`   🌐 Network-Captured Events: ${networkEvents.length}`);

    // Check for expected GA4 ID
    const expectedGA4 = 'G-84NHR3996T';
    const foundGA4IDs = [...new Set(ga4Events.map(e => e.params?.tid).filter(Boolean))];

    console.log(`\n   🔍 GA4 IDs Found: ${foundGA4IDs.join(', ') || 'None'}`);

    // Detailed event breakdown
    if (windowExtractedEvents.length > 0) {
      console.log('\n   📌 Window-Extracted GA4 IDs:');
      windowExtractedEvents.forEach(event => {
        const isExpected = event.params.tid === expectedGA4;
        const marker = isExpected ? '✅' : 'ℹ️';
        console.log(`      ${marker} ${event.params.tid} ${isExpected ? '(EXPECTED!)' : ''}`);
      });
    }

    if (networkEvents.length > 0) {
      console.log('\n   🌐 Network-Captured GA4 IDs:');
      networkEvents.forEach(event => {
        const isExpected = event.params.tid === expectedGA4;
        const marker = isExpected ? '✅' : 'ℹ️';
        console.log(`      ${marker} ${event.params.tid} ${isExpected ? '(EXPECTED!)' : ''}`);
      });
    }

    // Verification
    console.log('\n' + '═'.repeat(70));
    console.log('🔍 Verification Results:\n');

    const expectedGTM = 'GTM-MZH2JRFN';
    const gtmFound = gtmResult.gtmIds.includes(expectedGTM);
    const ga4Found = foundGA4IDs.includes(expectedGA4);
    const windowExtracted = windowExtractedEvents.some(e => e.params.tid === expectedGA4);

    // Test assertions
    const tests = [
      {
        name: 'GTM Container Detection',
        passed: gtmFound,
        expected: expectedGTM,
        actual: gtmResult.gtmIds.join(', ') || 'None'
      },
      {
        name: 'GA4 Measurement ID Detection',
        passed: ga4Found,
        expected: expectedGA4,
        actual: foundGA4IDs.join(', ') || 'None'
      },
      {
        name: 'Window Extraction (Consent Mode Bypass)',
        passed: windowExtracted,
        expected: 'GA4 ID extracted from window.google_tag_manager',
        actual: windowExtracted ? 'Success - extracted without consent' : 'Failed - not found in window'
      },
      {
        name: 'Consent Mode Compatibility',
        passed: windowExtractedEvents.length > 0 || networkEvents.length > 0,
        expected: 'GA4 detected despite Consent Mode',
        actual: `${windowExtractedEvents.length} window + ${networkEvents.length} network events`
      }
    ];

    tests.forEach(test => {
      const status = test.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`   ${status}: ${test.name}`);
      console.log(`      Expected: ${test.expected}`);
      console.log(`      Actual: ${test.actual}`);
      console.log('');
    });

    const allPassed = tests.every(t => t.passed);

    console.log('═'.repeat(70));
    if (allPassed) {
      console.log('✅ ALL TESTS PASSED - Story 11.1 AC3 Verified!');
      console.log('\n📝 Summary:');
      console.log('   - Window extraction successfully bypassed Consent Mode');
      console.log('   - GA4 ID detected without requiring user consent');
      console.log('   - Implementation meets AC3 requirements');
    } else {
      console.log('❌ SOME TESTS FAILED');
      const failedTests = tests.filter(t => !t.passed);
      console.log(`\n   Failed: ${failedTests.map(t => t.name).join(', ')}`);
    }
    console.log('═'.repeat(70));

    return allPassed;

  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    console.error(error.stack);
    return false;
  } finally {
    await browser.close();
  }
}

// Run test
testAesturaRealWorld()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
