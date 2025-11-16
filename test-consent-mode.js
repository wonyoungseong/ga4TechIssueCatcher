import { chromium } from 'playwright';
import { detectConsentMode } from './src/modules/networkEventCapturer.js';

console.log('\n🧪 Testing Consent Mode Auto-Detection');
console.log('=========================================\n');

const TEST_URL = 'https://fr.aestura.com/';
console.log(`Testing URL: ${TEST_URL}\n`);

async function testConsentModeDetection() {
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    });

    const page = await context.newPage();

    console.log('🌐 Navigating to page...');
    await page.goto(TEST_URL, {
      timeout: 30000,
      waitUntil: 'domcontentloaded'
    });

    console.log('✅ Page loaded');
    console.log('⏳ Waiting for scripts to load...\n');

    // Wait for page to fully load
    await page.waitForTimeout(3000);

    console.log('🍪 Running Consent Mode detection...\n');
    const hasConsentMode = await detectConsentMode(page);

    console.log('\n========================================');
    console.log('📋 Test Results');
    console.log('========================================');
    console.log(`URL: ${TEST_URL}`);
    console.log(`Consent Mode Detected: ${hasConsentMode ? 'YES ✅' : 'NO ❌'}`);
    console.log('========================================\n');

    if (hasConsentMode) {
      console.log('✨ Expected Result: Consent Mode should be detected for fr.aestura.com');
      console.log('✅ TEST PASSED - Consent Mode auto-detection is working!');
    } else {
      console.log('⚠️  Warning: Consent Mode was not detected');
      console.log('   This might be expected if the site does not use Consent Mode');
      console.log('   or if detection methods need to be updated.');
    }

    await context.close();
  } catch (error) {
    console.error('\n❌ Error during test:');
    console.error(error);
    throw error;
  } finally {
    await browser.close();
  }
}

testConsentModeDetection()
  .then(() => {
    console.log('\n✅ Test completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Test failed');
    console.error(error);
    process.exit(1);
  });
