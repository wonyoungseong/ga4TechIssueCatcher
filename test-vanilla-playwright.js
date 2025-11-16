/**
 * Test with vanilla Playwright (no stealth plugin) - same as MCP
 */

import { chromium } from 'playwright';

const urls = [
  'https://new.amorecounselor.com/',
  'https://jp.aestura.com',
  'https://www.amoremall.com/kr/ko/display/main',
  'https://www.ayunche.com',
  'https://www.ayunchepro.com',
  'https://www.illiyoon.com',
  'https://www.etude.com/'
];

async function testWithVanillaPlaywright() {
  console.log('\n' + '='.repeat(80));
  console.log('🧪 Testing with VANILLA Playwright (No Stealth Plugin) - Same as MCP');
  console.log('='.repeat(80));

  // Launch browser with MINIMAL args (like MCP)
  const browser = await chromium.launch({
    headless: true
    // NO extra args, NO stealth plugin - just like MCP
  });

  const results = [];

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const startTime = Date.now();

    try {
      console.log(`\n🌐 [${i + 1}/7] Testing: ${url}`);

      const context = await browser.newContext();
      const page = await context.newPage();

      const response = await page.goto(url, {
        timeout: 30000,
        waitUntil: 'domcontentloaded'
      });

      const loadTime = Date.now() - startTime;
      const statusCode = response ? response.status() : null;

      console.log(`   ✅ Loaded HTTP ${statusCode} in ${loadTime}ms`);

      if (loadTime > 20000) {
        console.log(`   ⚠️  WOULD TIMEOUT (${loadTime}ms > 20000ms)`);
      } else {
        console.log(`   ✅ WITHIN TIMEOUT (${loadTime}ms < 20000ms)`);
      }

      await page.close();
      await context.close();

      results.push({
        index: i + 1,
        url,
        success: true,
        loadTime,
        statusCode,
        wouldTimeout: loadTime > 20000
      });

    } catch (error) {
      const loadTime = Date.now() - startTime;
      console.log(`   ❌ ERROR: ${error.message} (${loadTime}ms)`);

      results.push({
        index: i + 1,
        url,
        success: false,
        loadTime,
        error: error.message,
        wouldTimeout: true
      });
    }
  }

  await browser.close();

  console.log('\n' + '='.repeat(80));
  console.log('📊 RESULTS SUMMARY');
  console.log('='.repeat(80));

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const wouldTimeout = results.filter(r => r.wouldTimeout);

  console.log(`Successful: ${successful.length}/7`);
  console.log(`Failed: ${failed.length}/7`);
  console.log(`Would Timeout (>20s): ${wouldTimeout.length}/7`);

  console.log('\n📋 Individual Results:');
  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    const timeout = result.wouldTimeout ? '⚠️ TIMEOUT' : '✅ OK';
    console.log(`${status} [${result.index}/7]: ${(result.loadTime / 1000).toFixed(2)}s - ${timeout}`);
    console.log(`   ${result.url}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });

  console.log('='.repeat(80));

  if (wouldTimeout.length === 0) {
    console.log(`\n✅ SUCCESS! All sites loaded within 20s with vanilla Playwright (like MCP)`);
  } else {
    console.log(`\n⚠️  ${wouldTimeout.length} site(s) still timeout with vanilla Playwright`);
  }

  return results;
}

testWithVanillaPlaywright().catch(console.error);
