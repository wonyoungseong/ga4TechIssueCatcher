/**
 * Direct console test for AESTURA - simulating manual console input
 */

import { chromium } from 'playwright';

async function testConsoleDirectly() {
  const browser = await chromium.launch({
    headless: false, // Show browser to see what's happening
    args: [
      '--disable-blink-features=AutomationControlled'
    ]
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 }
    });

    const page = await context.newPage();

    console.log('🌐 Navigating to AESTURA...');
    await page.goto('https://fr.aestura.com/', {
      waitUntil: 'domcontentloaded'
    });

    console.log('⏳ Waiting for page to fully load...');
    await page.waitForTimeout(10000); // Wait 10 seconds for everything to load

    console.log('\n📋 Executing window.google_tag_manager directly (like in console)...\n');

    // Method 1: Direct evaluation exactly as typed in console
    const directResult = await page.evaluate(() => {
      return window.google_tag_manager;
    });

    console.log('Direct window.google_tag_manager result:');
    console.log('Type:', typeof directResult);
    console.log('Keys:', Object.keys(directResult));
    console.log('\n');

    // Method 2: Check each key individually
    console.log('Checking each key of window.google_tag_manager:');
    const keys = await page.evaluate(() => {
      const result = [];
      for (let key in window.google_tag_manager) {
        result.push({
          key: key,
          type: typeof window.google_tag_manager[key],
          isGA4: key.startsWith('G-'),
          isGTM: key.startsWith('GTM-')
        });
      }
      return result;
    });

    keys.forEach(item => {
      if (item.isGA4) {
        console.log(`✅ GA4 KEY FOUND: ${item.key}`);
      } else if (item.isGTM) {
        console.log(`📦 GTM KEY FOUND: ${item.key}`);
      } else {
        console.log(`  - ${item.key} (${item.type})`);
      }
    });

    console.log('\n');

    // Method 3: Check if specific GA4 ID exists as key
    const hasExpectedGA4 = await page.evaluate(() => {
      return 'G-67KP9F9311' in window.google_tag_manager;
    });
    console.log(`Does window.google_tag_manager['G-67KP9F9311'] exist? ${hasExpectedGA4}`);

    // Method 4: Try to access it directly
    const directAccess = await page.evaluate(() => {
      return window.google_tag_manager['G-67KP9F9311'];
    });
    console.log(`Direct access window.google_tag_manager['G-67KP9F9311']:`,
                directAccess ? 'EXISTS' : 'UNDEFINED');

    // Method 5: List all keys that start with 'G-'
    console.log('\n🔍 All keys starting with "G-":');
    const ga4Keys = await page.evaluate(() => {
      const keys = [];
      for (let key in window.google_tag_manager) {
        if (key.startsWith('G-')) {
          keys.push(key);
        }
      }
      return keys;
    });
    console.log('GA4 Keys found:', ga4Keys.length > 0 ? ga4Keys : 'NONE');

    // Method 6: Check after even longer wait
    console.log('\n⏳ Waiting 20 more seconds and checking again...');
    await page.waitForTimeout(20000);

    const finalCheck = await page.evaluate(() => {
      const ga4Keys = [];
      const gtmKeys = [];

      for (let key in window.google_tag_manager) {
        if (key.startsWith('G-')) {
          ga4Keys.push(key);
        } else if (key.startsWith('GTM-')) {
          gtmKeys.push(key);
        }
      }

      return { ga4Keys, gtmKeys };
    });

    console.log('\n📊 FINAL CHECK RESULTS:');
    console.log('GTM Keys:', finalCheck.gtmKeys);
    console.log('GA4 Keys:', finalCheck.ga4Keys);

    console.log('\n==================================================');
    console.log('📝 SUMMARY');
    console.log('==================================================');
    console.log('Expected GA4 ID: G-67KP9F9311');
    console.log('Found in window.google_tag_manager:', finalCheck.ga4Keys.includes('G-67KP9F9311') ? '✅ YES' : '❌ NO');

    if (finalCheck.ga4Keys.length > 0) {
      console.log('Other GA4 IDs found:', finalCheck.ga4Keys);
    }

    // Keep browser open for manual inspection
    console.log('\n💡 Browser will stay open for 30 seconds.');
    console.log('Try typing "window.google_tag_manager" in the browser console yourself.');
    await page.waitForTimeout(30000);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
    console.log('\n✅ Test completed');
  }
}

testConsoleDirectly().catch(console.error);