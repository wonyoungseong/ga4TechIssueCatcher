/**
 * Direct test for AESTURA property GA4 extraction with window inspection
 */

import { chromium } from 'playwright';

async function testAestura() {
  const browser = await chromium.launch({
    headless: false, // Show browser for debugging
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-features=site-per-process',
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ]
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    const page = await context.newPage();

    console.log('🌐 Navigating to AESTURA France site...');
    console.log('URL: https://fr.aestura.com/');
    console.log('Expected GA4: G-67KP9F9311');
    console.log('Expected GTM: GTM-5XNBCTB7');
    console.log('---');

    await page.goto('https://fr.aestura.com/', {
      waitUntil: 'domcontentloaded', // Changed from networkidle to avoid timeout
      timeout: 30000
    });

    console.log('✅ Page loaded, waiting for GTM to initialize...');

    // Wait a bit for GTM to load
    await page.waitForTimeout(5000);

    // Check window.google_tag_manager object
    console.log('\n📋 Checking window.google_tag_manager object...');
    const windowData = await page.evaluate(() => {
      const result = {
        hasGoogleTagManager: typeof window.google_tag_manager !== 'undefined',
        gtmKeys: [],
        ga4Keys: [],
        otherKeys: [],
        fullObject: null
      };

      if (window.google_tag_manager) {
        const gtm = window.google_tag_manager;
        result.fullObject = {};

        Object.keys(gtm).forEach(key => {
          if (key.startsWith('GTM-')) {
            result.gtmKeys.push(key);
          } else if (key.startsWith('G-')) {
            result.ga4Keys.push(key);
          } else {
            result.otherKeys.push(key);
          }

          // Store a simplified version of the object
          try {
            const value = gtm[key];
            if (typeof value === 'object' && value !== null) {
              result.fullObject[key] = Object.keys(value).slice(0, 5) + '...';
            } else {
              result.fullObject[key] = typeof value;
            }
          } catch (e) {
            result.fullObject[key] = 'Error accessing';
          }
        });
      }

      return result;
    });

    console.log('\n📊 Window Analysis Results:');
    console.log('Has google_tag_manager:', windowData.hasGoogleTagManager);
    console.log('GTM Container IDs found:', windowData.gtmKeys);
    console.log('GA4 Measurement IDs found:', windowData.ga4Keys);
    console.log('Other keys:', windowData.otherKeys);

    if (windowData.fullObject) {
      console.log('\n🔍 Full object structure:');
      console.log(JSON.stringify(windowData.fullObject, null, 2));
    }

    // Check dataLayer
    console.log('\n📋 Checking dataLayer...');
    const dataLayerInfo = await page.evaluate(() => {
      if (typeof window.dataLayer !== 'undefined' && Array.isArray(window.dataLayer)) {
        return {
          exists: true,
          length: window.dataLayer.length,
          gtmFound: window.dataLayer.some(item =>
            JSON.stringify(item).includes('GTM-') || JSON.stringify(item).includes('G-')
          ),
          sample: window.dataLayer.slice(0, 3)
        };
      }
      return { exists: false };
    });

    console.log('DataLayer exists:', dataLayerInfo.exists);
    if (dataLayerInfo.exists) {
      console.log('DataLayer length:', dataLayerInfo.length);
      console.log('GTM/GA4 references found:', dataLayerInfo.gtmFound);
      if (dataLayerInfo.sample) {
        console.log('Sample entries:', JSON.stringify(dataLayerInfo.sample, null, 2));
      }
    }

    // Check for GA4 in other common locations
    console.log('\n🔍 Checking other common GA4 locations...');
    const otherChecks = await page.evaluate(() => {
      const checks = {};

      // Check gtag
      checks.hasGtag = typeof window.gtag === 'function';

      // Check for GA4 config in page HTML
      const html = document.documentElement.innerHTML;
      checks.ga4InHtml = html.includes('G-67KP9F9311');
      checks.gtmInHtml = html.includes('GTM-5XNBCTB7');

      // Check for measurement ID in scripts
      const scripts = Array.from(document.querySelectorAll('script'));
      checks.ga4InScripts = scripts.some(s => s.textContent.includes('G-67KP9F9311'));
      checks.gtmInScripts = scripts.some(s => s.src.includes('GTM-5XNBCTB7') || s.textContent.includes('GTM-5XNBCTB7'));

      return checks;
    });

    console.log('Has gtag function:', otherChecks.hasGtag);
    console.log('GA4 ID in HTML:', otherChecks.ga4InHtml);
    console.log('GTM ID in HTML:', otherChecks.gtmInHtml);
    console.log('GA4 ID in scripts:', otherChecks.ga4InScripts);
    console.log('GTM ID in scripts:', otherChecks.gtmInScripts);

    // Try waiting longer and checking again
    console.log('\n⏳ Waiting 10 seconds for late initialization...');
    await page.waitForTimeout(10000);

    const secondCheck = await page.evaluate(() => {
      const result = {
        gtmKeys: [],
        ga4Keys: []
      };

      if (window.google_tag_manager) {
        Object.keys(window.google_tag_manager).forEach(key => {
          if (key.startsWith('GTM-')) {
            result.gtmKeys.push(key);
          } else if (key.startsWith('G-')) {
            result.ga4Keys.push(key);
          }
        });
      }

      return result;
    });

    console.log('\n📊 Second Check Results:');
    console.log('GTM Container IDs:', secondCheck.gtmKeys);
    console.log('GA4 Measurement IDs:', secondCheck.ga4Keys);

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📝 SUMMARY');
    console.log('='.repeat(50));

    const foundGa4 = windowData.ga4Keys.includes('G-67KP9F9311') ||
                     secondCheck.ga4Keys.includes('G-67KP9F9311');
    const foundGtm = windowData.gtmKeys.includes('GTM-5XNBCTB7') ||
                     secondCheck.gtmKeys.includes('GTM-5XNBCTB7');

    console.log('Expected GA4 (G-67KP9F9311):', foundGa4 ? '✅ FOUND' : '❌ NOT FOUND');
    console.log('Expected GTM (GTM-5XNBCTB7):', foundGtm ? '✅ FOUND' : '❌ NOT FOUND');

    if (windowData.ga4Keys.length > 0 || secondCheck.ga4Keys.length > 0) {
      console.log('GA4 IDs detected:', [...new Set([...windowData.ga4Keys, ...secondCheck.ga4Keys])]);
    }

    if (windowData.gtmKeys.length > 0 || secondCheck.gtmKeys.length > 0) {
      console.log('GTM IDs detected:', [...new Set([...windowData.gtmKeys, ...secondCheck.gtmKeys])]);
    }

    // Keep browser open for 30 seconds for manual inspection
    console.log('\n⏰ Keeping browser open for 30 seconds for inspection...');
    await page.waitForTimeout(30000);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
    console.log('\n✅ Test completed');
  }
}

testAestura().catch(console.error);