/**
 * Debug Script: Inspect window.google_tag_manager structure on AESTURA
 */

import playwright from 'playwright';

async function debugAesturaWindow() {
  const browser = await playwright.chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    console.log('🌐 Loading AESTURA...');
    await page.goto('https://www.aestura.com/web/main.do', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // Wait a bit for GTM to initialize
    await page.waitForTimeout(3000);

    // Inspect window.google_tag_manager structure
    const inspection = await page.evaluate(() => {
      if (!window.google_tag_manager) {
        return { exists: false };
      }

      const gtm = window.google_tag_manager;
      const keys = Object.keys(gtm);

      const details = {};
      keys.forEach(key => {
        const value = gtm[key];
        details[key] = {
          type: typeof value,
          isObject: typeof value === 'object',
          keys: typeof value === 'object' && value !== null ? Object.keys(value).slice(0, 10) : null,
          sample: typeof value === 'object' && value !== null ?
            JSON.stringify(value, null, 2).substring(0, 200) :
            String(value).substring(0, 100)
        };
      });

      return {
        exists: true,
        totalKeys: keys.length,
        keys,
        details
      };
    });

    console.log('\n📊 window.google_tag_manager Inspection:');
    console.log(JSON.stringify(inspection, null, 2));

    // Check for GA4 config in dataLayer
    const dataLayerCheck = await page.evaluate(() => {
      if (!window.dataLayer) return { exists: false };

      const ga4Configs = window.dataLayer.filter(item => {
        return item && (
          item['gtm.start'] ||
          (typeof item === 'object' && JSON.stringify(item).includes('G-'))
        );
      });

      return {
        exists: true,
        length: window.dataLayer.length,
        ga4Configs: ga4Configs.slice(0, 5)
      };
    });

    console.log('\n📊 dataLayer Check:');
    console.log(JSON.stringify(dataLayerCheck, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

debugAesturaWindow();
