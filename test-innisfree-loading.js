#!/usr/bin/env node
import playwright from 'playwright';

const url = 'https://www.innisfree.com/kr/ko/';

console.log('\n' + '='.repeat(80));
console.log('🧪 Testing Innisfree KR Loading Time');
console.log('='.repeat(80));
console.log(`URL: ${url}\n`);

const browser = await playwright.chromium.launch({
  headless: true
});

const context = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
});

const page = await context.newPage();

console.log('🔄 Attempting to load page with 80s timeout...\n');

const startTime = Date.now();
let loadSuccess = false;
let errorMessage = null;

try {
  await page.goto(url, {
    waitUntil: 'domcontentloaded',
    timeout: 80000
  });
  loadSuccess = true;
  console.log('✅ Page loaded successfully!');
} catch (error) {
  errorMessage = error.message;
  console.log(`❌ Page load failed: ${error.message}`);
}

const endTime = Date.now();
const loadTime = endTime - startTime;

console.log(`\n⏱️  Load time: ${loadTime}ms (${(loadTime / 1000).toFixed(1)}s)`);

if (loadSuccess) {
  const title = await page.title();
  const finalUrl = page.url();
  
  console.log(`\n📄 Page Info:`);
  console.log(`   Title: ${title}`);
  console.log(`   Final URL: ${finalUrl}`);
  console.log(`   Redirected: ${finalUrl !== url ? 'Yes' : 'No'}`);
  
  // Take a screenshot as evidence
  await page.screenshot({ path: 'innisfree-kr-test.png', fullPage: false });
  console.log(`\n📸 Screenshot saved: innisfree-kr-test.png`);
} else {
  console.log(`\n⚠️  Could not retrieve page info due to load failure`);
}

await browser.close();

console.log('\n' + '='.repeat(80));
console.log('📊 Summary');
console.log('='.repeat(80));
console.log(`Load Status: ${loadSuccess ? 'SUCCESS ✅' : 'FAILED ❌'}`);
console.log(`Load Time: ${(loadTime / 1000).toFixed(1)}s`);

if (loadTime > 80000) {
  console.log(`\n🚨 CONFIRMED: Site exceeds 80s timeout`);
} else if (loadTime > 10000) {
  console.log(`\n⚠️  Site is slow (>${(loadTime / 1000).toFixed(1)}s) but within 80s limit`);
} else {
  console.log(`\n✅ Site loads quickly (<10s)`);
}

console.log('\n' + '='.repeat(80) + '\n');
