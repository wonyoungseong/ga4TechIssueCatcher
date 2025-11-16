/**
 * Test single browser sequential execution (for comparison)
 */

import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

chromium.use(StealthPlugin());

const urls = [
  'https://new.amorecounselor.com/',
  'https://jp.aestura.com',
  'https://www.amoremall.com/kr/ko/display/main',
  'https://www.ayunche.com',
  'https://www.ayunchepro.com',
  'https://www.illiyoon.com',
  'https://www.etude.com/'
];

async function testSequential() {
  console.log('\n' + '='.repeat(80));
  console.log('🧪 Testing Single Browser Sequential Execution (For Comparison)');
  console.log('='.repeat(80));

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-site-isolation-trials',
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      '--disable-hang-monitor',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-popup-blocking',
      '--disable-infobars',
      '--disable-notifications',
      '--disable-extensions',
      '--disable-translate',
      '--disable-component-extensions-with-background-pages',
      '--mute-audio',
      '--disable-background-networking',
      '--max-old-space-size=500'
    ],
    ignoreDefaultArgs: ['--enable-automation', '--enable-blink-features=AutomationControlled']
  });

  const results = [];

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const startTime = Date.now();

    try {
      console.log(`\n🌐 [${i + 1}/7] Testing: ${url}`);

      const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        locale: 'ko-KR',
        timezoneId: 'Asia/Seoul'
      });

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

  if (wouldTimeout.length > 0) {
    console.log(`\n⚠️  ${wouldTimeout.length} site(s) would timeout with 20s limit in sequential execution`);
  } else {
    console.log(`\n✅ All sites loaded within 20s timeout in sequential execution`);
  }
}

testSequential().catch(console.error);
