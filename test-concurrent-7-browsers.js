/**
 * Test 7 concurrent browser instances to simulate actual crawling
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

async function testSingleBrowser(url, browserIndex) {
  const startTime = Date.now();
  let browser;

  try {
    console.log(`\n🌐 Browser ${browserIndex + 1}: Starting...`);

    // Launch browser with same config as crawler
    browser = await chromium.launch({
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

    console.log(`   ✅ Browser ${browserIndex + 1}: Launched (${Date.now() - startTime}ms)`);

    // Create context
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'ko-KR',
      timezoneId: 'Asia/Seoul'
    });

    const page = await context.newPage();
    console.log(`   ✅ Browser ${browserIndex + 1}: Page created (${Date.now() - startTime}ms)`);

    // Navigate
    console.log(`   🔄 Browser ${browserIndex + 1}: Navigating to ${url}...`);
    const response = await page.goto(url, {
      timeout: 30000,
      waitUntil: 'domcontentloaded'
    });

    const loadTime = Date.now() - startTime;
    const statusCode = response ? response.status() : null;

    console.log(`   ✅ Browser ${browserIndex + 1}: Loaded HTTP ${statusCode} in ${loadTime}ms`);

    // Check if it would timeout at 20s
    if (loadTime > 20000) {
      console.log(`   ⚠️  Browser ${browserIndex + 1}: WOULD TIMEOUT (>${loadTime}ms > 20000ms)`);
    } else {
      console.log(`   ✅ Browser ${browserIndex + 1}: WITHIN TIMEOUT (${loadTime}ms < 20000ms)`);
    }

    await page.close();
    await context.close();
    await browser.close();

    return {
      browserIndex: browserIndex + 1,
      url,
      success: true,
      loadTime,
      statusCode,
      wouldTimeout: loadTime > 20000
    };

  } catch (error) {
    const loadTime = Date.now() - startTime;
    console.log(`   ❌ Browser ${browserIndex + 1}: ERROR - ${error.message} (${loadTime}ms)`);

    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        // Ignore
      }
    }

    return {
      browserIndex: browserIndex + 1,
      url,
      success: false,
      loadTime,
      error: error.message,
      wouldTimeout: true
    };
  }
}

async function testConcurrent() {
  console.log('\n' + '='.repeat(80));
  console.log('🧪 Testing 7 Concurrent Browsers (Same as Crawler Configuration)');
  console.log('='.repeat(80));
  console.log(`Phase 1 Timeout: 20000ms (20 seconds)`);
  console.log(`Browser Pool Size: 7`);
  console.log('='.repeat(80));

  const startTime = Date.now();

  // Launch all 7 browsers concurrently
  const promises = urls.map((url, index) => testSingleBrowser(url, index));
  const results = await Promise.all(promises);

  const totalTime = Date.now() - startTime;

  console.log('\n' + '='.repeat(80));
  console.log('📊 RESULTS SUMMARY');
  console.log('='.repeat(80));

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const wouldTimeout = results.filter(r => r.wouldTimeout);

  console.log(`Total Time: ${(totalTime / 1000).toFixed(2)}s`);
  console.log(`Successful: ${successful.length}/7`);
  console.log(`Failed: ${failed.length}/7`);
  console.log(`Would Timeout (>20s): ${wouldTimeout.length}/7`);

  console.log('\n📋 Individual Results:');
  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    const timeout = result.wouldTimeout ? '⚠️ TIMEOUT' : '✅ OK';
    console.log(`${status} Browser ${result.browserIndex}: ${(result.loadTime / 1000).toFixed(2)}s - ${timeout}`);
    console.log(`   ${result.url}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });

  console.log('='.repeat(80));

  if (wouldTimeout.length > 0) {
    console.log(`\n⚠️  ${wouldTimeout.length} site(s) would timeout with 20s limit in concurrent execution`);
  } else {
    console.log(`\n✅ All sites loaded within 20s timeout in concurrent execution`);
  }
}

testConcurrent().catch(console.error);
