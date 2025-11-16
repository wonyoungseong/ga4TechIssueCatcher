/**
 * Single Property Verification Script
 *
 * 특정 속성의 GA4 ID가 CSV와 일치하는지 단독으로 확인
 * 여러 번 반복 테스트로 일관성 검증
 */

import { chromium } from 'playwright';
import { createStealthPage } from './src/modules/browserPoolManager.js';
import { startCapturing, waitForGA4Events, extractAllMeasurementIds, extractAllGTMIds } from './src/modules/networkEventCapturer.js';

const TEST_PROPERTY = {
  propertyName: '[EC] AYUNCHEPRO - KR',
  csvMeasurementId: 'G-LLLJVS3JRX',  // CSV에 있는 값
  url: 'https://www.ayunchepro.com',
  csvGTMId: 'GTM-PFZJG9F3'
};

const REPEAT_COUNT = 3;  // 3번 반복 테스트

async function verifySingleProperty() {
  console.log('\n' + '='.repeat(80));
  console.log(`🔍 Verifying: ${TEST_PROPERTY.propertyName}`);
  console.log('='.repeat(80));
  console.log(`CSV Expected GA4: ${TEST_PROPERTY.csvMeasurementId}`);
  console.log(`CSV Expected GTM: ${TEST_PROPERTY.csvGTMId}`);
  console.log(`URL: ${TEST_PROPERTY.url}`);
  console.log(`Repeat Count: ${REPEAT_COUNT} times`);
  console.log('='.repeat(80) + '\n');

  const results = [];

  for (let i = 1; i <= REPEAT_COUNT; i++) {
    console.log(`\n📍 Test ${i}/${REPEAT_COUNT}`);
    console.log('-'.repeat(80));

    const browser = await chromium.launch({
      headless: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process'
      ]
    });

    try {
      const page = await createStealthPage(browser);
      const capturedEvents = await startCapturing(page);

      console.log(`🌐 Navigating to ${TEST_PROPERTY.url}...`);
      await page.goto(TEST_PROPERTY.url, {
        timeout: 30000,
        waitUntil: 'domcontentloaded'
      });

      console.log(`⏳ Waiting for GA4 events...`);
      const { events, timing } = await waitForGA4Events(
        page,
        capturedEvents,
        TEST_PROPERTY.csvMeasurementId,  // Expected ID
        60000,  // 60s timeout
        20000   // 20s max wait after page_view
      );

      const allMeasurementIds = extractAllMeasurementIds(events);
      const allGTMIds = extractAllGTMIds(events);

      const result = {
        attempt: i,
        ga4Ids: allMeasurementIds,
        gtmIds: allGTMIds,
        csvGA4Found: allMeasurementIds.includes(TEST_PROPERTY.csvMeasurementId),
        csvGTMFound: allGTMIds.includes(TEST_PROPERTY.csvGTMId),
        detectionTime: timing.detectionTimeMs,
        timedOut: timing.timedOut
      };

      results.push(result);

      console.log(`\n✅ Test ${i} Results:`);
      console.log(`   GA4 IDs: [${allMeasurementIds.join(', ')}]`);
      console.log(`   GTM IDs: [${allGTMIds.join(', ')}]`);
      console.log(`   CSV GA4 Found: ${result.csvGA4Found ? '✅' : '❌'}`);
      console.log(`   CSV GTM Found: ${result.csvGTMFound ? '✅' : '❌'}`);
      console.log(`   Detection Time: ${result.detectionTime}ms`);

      await page.close();
    } catch (error) {
      console.error(`❌ Test ${i} failed:`, error.message);
      results.push({
        attempt: i,
        error: error.message
      });
    } finally {
      await browser.close();
    }

    // Wait 2 seconds between tests
    if (i < REPEAT_COUNT) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Analysis
  console.log('\n' + '='.repeat(80));
  console.log('📊 VERIFICATION ANALYSIS');
  console.log('='.repeat(80));

  const successfulTests = results.filter(r => !r.error);
  const csvGA4FoundCount = successfulTests.filter(r => r.csvGA4Found).length;
  const csvGTMFoundCount = successfulTests.filter(r => r.csvGTMFound).length;

  // Collect all unique GA4 IDs across tests
  const allUniqueGA4 = [...new Set(successfulTests.flatMap(r => r.ga4Ids))];
  const allUniqueGTM = [...new Set(successfulTests.flatMap(r => r.gtmIds))];

  console.log(`\n📈 Consistency Analysis:`);
  console.log(`   Total Tests: ${REPEAT_COUNT}`);
  console.log(`   Successful: ${successfulTests.length}`);
  console.log(`   Failed: ${results.length - successfulTests.length}`);

  console.log(`\n📍 GA4 Measurement ID:`);
  console.log(`   CSV Expected: ${TEST_PROPERTY.csvMeasurementId}`);
  console.log(`   Found in ${csvGA4FoundCount}/${successfulTests.length} tests`);
  console.log(`   All Unique IDs Detected: [${allUniqueGA4.join(', ')}]`);

  console.log(`\n🏷️  GTM Container ID:`);
  console.log(`   CSV Expected: ${TEST_PROPERTY.csvGTMId}`);
  console.log(`   Found in ${csvGTMFoundCount}/${successfulTests.length} tests`);
  console.log(`   All Unique IDs Detected: [${allUniqueGTM.join(', ')}]`);

  // Verdict
  console.log('\n' + '='.repeat(80));
  console.log('⚖️  VERDICT');
  console.log('='.repeat(80));

  const ga4Verdict = csvGA4FoundCount === successfulTests.length;
  const gtmVerdict = csvGTMFoundCount === successfulTests.length;

  if (ga4Verdict) {
    console.log(`\n✅ GA4: CSV is CORRECT`);
    console.log(`   ${TEST_PROPERTY.csvMeasurementId} consistently found in all ${successfulTests.length} tests`);
  } else if (csvGA4FoundCount === 0) {
    console.log(`\n❌ GA4: CSV is INCORRECT`);
    console.log(`   ${TEST_PROPERTY.csvMeasurementId} never found in any test`);
    console.log(`   Site actually uses: [${allUniqueGA4.join(', ')}]`);
    console.log(`   👉 UPDATE CSV with correct ID`);
  } else {
    console.log(`\n⚠️  GA4: INCONSISTENT (found in ${csvGA4FoundCount}/${successfulTests.length} tests)`);
    console.log(`   Possible causes:`);
    console.log(`   - Dynamic/conditional GA4 loading`);
    console.log(`   - A/B testing`);
    console.log(`   - Resource contention (timing issue)`);
    console.log(`   👉 Re-run with more tests or investigate site GA4 implementation`);
  }

  if (gtmVerdict) {
    console.log(`\n✅ GTM: CSV is CORRECT`);
    console.log(`   ${TEST_PROPERTY.csvGTMId} consistently found in all ${successfulTests.length} tests`);
  } else if (csvGTMFoundCount === 0) {
    console.log(`\n❌ GTM: CSV is INCORRECT`);
    console.log(`   ${TEST_PROPERTY.csvGTMId} never found in any test`);
    console.log(`   Site actually uses: [${allUniqueGTM.join(', ')}]`);
    console.log(`   👉 UPDATE CSV with correct ID`);
  } else {
    console.log(`\n⚠️  GTM: INCONSISTENT (found in ${csvGTMFoundCount}/${successfulTests.length} tests)`);
  }

  console.log('\n' + '='.repeat(80));

  // Detailed results
  console.log('\n📋 Detailed Test Results:');
  console.log('-'.repeat(80));
  results.forEach(result => {
    if (result.error) {
      console.log(`\nTest ${result.attempt}: ❌ FAILED`);
      console.log(`  Error: ${result.error}`);
    } else {
      console.log(`\nTest ${result.attempt}:`);
      console.log(`  GA4: [${result.ga4Ids.join(', ')}] ${result.csvGA4Found ? '✅' : '❌'}`);
      console.log(`  GTM: [${result.gtmIds.join(', ')}] ${result.csvGTMFound ? '✅' : '❌'}`);
      console.log(`  Time: ${result.detectionTime}ms`);
    }
  });

  console.log('\n' + '='.repeat(80) + '\n');
}

verifySingleProperty();
