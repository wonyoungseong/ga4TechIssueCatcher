/**
 * Test actual validateSingleProperty timing with detailed breakdown
 */

import { chromium } from 'playwright';
import { createStealthPage } from './src/modules/browserPoolManager.js';
import { startCapturing, waitForGA4Events, waitForGTMLoad } from './src/modules/networkEventCapturer.js';

const testUrl = 'https://www.etude.com/';

async function testValidateTiming() {
  console.log('\n=== Testing Actual Validation Timing ===\n');
  console.log(`URL: ${testUrl}\n`);

  const browser = await chromium.launch({ headless: true });
  const totalStartTime = Date.now();

  try {
    console.log('1️⃣ Creating stealth page...');
    const stepStart = Date.now();
    const page = await createStealthPage(browser);
    console.log(`   ✅ Completed in ${Date.now() - stepStart}ms\n`);

    console.log('2️⃣ Starting network event capture...');
    const captureStart = Date.now();
    const capturedEvents = await startCapturing(page);
    console.log(`   ✅ Completed in ${Date.now() - captureStart}ms\n`);

    console.log('3️⃣ Navigating to URL...');
    const navStart = Date.now();
    await page.goto(testUrl, {
      timeout: 30000,
      waitUntil: 'domcontentloaded'
    });
    const navTime = Date.now() - navStart;
    console.log(`   ✅ Navigation completed in ${navTime}ms\n`);

    console.log('4️⃣ Simulating user interaction...');
    const interactionStart = Date.now();
    await page.evaluate(() => {
      window.scrollTo(0, 100);
      window.scrollTo(0, 0);
      const body = document.body;
      body.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
    });
    await page.waitForTimeout(3000);
    const interactionTime = Date.now() - interactionStart;
    console.log(`   ✅ User interaction completed in ${interactionTime}ms\n`);

    console.log('5️⃣ Waiting for GTM load...');
    const gtmStart = Date.now();
    const gtmResult = await waitForGTMLoad(page, capturedEvents, 'GTM-XXXXX', 30000);
    const gtmTime = Date.now() - gtmStart;
    console.log(`   ${gtmResult.found ? '✅' : '⚠️'} GTM wait completed in ${gtmTime}ms`);
    if (gtmResult.found) {
      console.log(`   GTM ID: ${gtmResult.gtmId}`);
    }
    console.log('');

    console.log('6️⃣ Waiting for GA4 page_view event...');
    const ga4Start = Date.now();
    const ga4Result = await waitForGA4Events(
      page,
      capturedEvents,
      'G-XXXXX', // Dummy ID for testing
      60000, // 60 second timeout
      15000  // 15 second max wait after first event
    );
    const ga4Time = Date.now() - ga4Start;
    console.log(`   ${ga4Result.found ? '✅' : '⚠️'} GA4 wait completed in ${ga4Time}ms`);
    console.log(`   Events captured: ${capturedEvents.length}`);
    console.log(`   Page view found: ${ga4Result.found}`);
    console.log('');

    const totalTime = Date.now() - totalStartTime;

    console.log('='.repeat(60));
    console.log('📊 TIMING BREAKDOWN');
    console.log('='.repeat(60));
    console.log(`Navigation:        ${navTime}ms`);
    console.log(`User Interaction:  ${interactionTime}ms`);
    console.log(`GTM Wait:          ${gtmTime}ms`);
    console.log(`GA4 Wait:          ${ga4Time}ms`);
    console.log('-'.repeat(60));
    console.log(`TOTAL:             ${totalTime}ms`);
    console.log('='.repeat(60));

    if (totalTime > 20000) {
      console.log(`\n⚠️  Would TIMEOUT in Phase 1 (${totalTime}ms > 20000ms)`);
      console.log(`❗ Main bottleneck: ${ga4Time > 10000 ? 'GA4 Wait' : gtmTime > 5000 ? 'GTM Wait' : 'Navigation'}`);
    } else {
      console.log(`\n✅ Within Phase 1 timeout (${totalTime}ms < 20000ms)`);
    }

    await page.close();
    await browser.close();

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    await browser.close();
    throw error;
  }
}

testValidateTiming().catch(console.error);
