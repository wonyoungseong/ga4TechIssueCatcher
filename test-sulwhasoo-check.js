import { chromium } from 'playwright';

(async () => {
  console.log('\n🧪 Testing us.sulwhasoo.com GA4 Detection\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const ga4Requests = [];
  const gtmRequests = [];

  page.on('request', request => {
    const url = request.url();

    // Check for GA4 requests
    if (url.includes('/g/collect')) {
      const urlObj = new URL(url);
      ga4Requests.push({
        url: url.substring(0, 150),
        domain: urlObj.hostname
      });
      console.log(`[GA4 Request] ${urlObj.hostname}/g/collect`);

      // Extract tid (measurement ID)
      const tid = urlObj.searchParams.get('tid');
      if (tid) {
        console.log(`  → Measurement ID: ${tid}`);
      }
    }

    // Check for GTM requests
    if (url.includes('gtm.js')) {
      const urlObj = new URL(url);
      const id = urlObj.searchParams.get('id');
      gtmRequests.push({ url, id });
      console.log(`[GTM Request] ID: ${id}`);
    }
  });

  console.log('Navigating to https://us.sulwhasoo.com...\n');
  try {
    await page.goto('https://us.sulwhasoo.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log('Page loaded successfully\n');
  } catch (error) {
    console.error('Navigation error:', error.message);
  }

  console.log('Waiting 10 seconds for analytics to load...\n');
  await page.waitForTimeout(10000);

  console.log('\n=== Test Results ===');
  console.log(`Total GA4 Requests: ${ga4Requests.length}`);
  console.log(`Total GTM Requests: ${gtmRequests.length}`);

  if (ga4Requests.length > 0) {
    console.log('\n✅ GA4 is working!');
    ga4Requests.forEach((req, i) => {
      console.log(`  ${i + 1}. ${req.domain}`);
    });
  } else {
    console.log('\n❌ No GA4 requests detected');
  }

  if (gtmRequests.length > 0) {
    console.log('\n✅ GTM is working!');
    gtmRequests.forEach((req, i) => {
      console.log(`  ${i + 1}. ${req.id}`);
    });
  } else {
    console.log('\n❌ No GTM requests detected');
  }

  await browser.close();
  console.log('\n✅ Test completed\n');
})();
