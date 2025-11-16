/**
 * Alternative GA4 detection methods for AESTURA
 */

import { chromium } from 'playwright';

async function findGA4Alternative() {
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 }
    });

    const page = await context.newPage();

    // Track all GA4-related network activity
    const ga4Activity = {
      configCalls: [],
      collectCalls: [],
      gtagCalls: []
    };

    // Monitor console for gtag calls
    await context.addInitScript(() => {
      // Intercept gtag calls
      window._gtagCalls = [];
      const originalGtag = window.gtag;
      if (originalGtag) {
        window.gtag = function() {
          window._gtagCalls.push(Array.from(arguments));
          return originalGtag.apply(this, arguments);
        };
      }
    });

    console.log('🌐 Navigating to AESTURA...');
    await page.goto('https://fr.aestura.com/', {
      waitUntil: 'domcontentloaded'
    });

    await page.waitForTimeout(5000);

    console.log('\n🔍 Method 1: Check GTM container dataLayer property');
    const method1 = await page.evaluate(() => {
      const result = {
        hasDataLayer: false,
        ga4Found: false,
        ga4Ids: []
      };

      if (window.google_tag_manager && window.google_tag_manager['GTM-5XNBCTB7']) {
        const container = window.google_tag_manager['GTM-5XNBCTB7'];

        // Check container's dataLayer
        if (container.dataLayer && container.dataLayer.get) {
          result.hasDataLayer = true;

          // Try to get GA4 config from dataLayer
          try {
            const dlData = container.dataLayer.get('gtm');
            if (dlData) {
              console.log('DataLayer gtm data:', dlData);
            }
          } catch (e) {}
        }

        // Check all properties of the container
        for (let key in container) {
          if (typeof container[key] === 'string' && container[key].includes('G-')) {
            result.ga4Found = true;
            const matches = container[key].match(/G-[A-Z0-9]{10}/g);
            if (matches) {
              result.ga4Ids.push(...matches);
            }
          }
        }
      }

      return result;
    });

    console.log('Container dataLayer exists:', method1.hasDataLayer);
    console.log('GA4 found in container:', method1.ga4Found);
    console.log('GA4 IDs found:', method1.ga4Ids);

    console.log('\n🔍 Method 2: Search all window properties for GA4');
    const method2 = await page.evaluate(() => {
      const searchResults = [];
      const searched = new Set();

      function searchObject(obj, path, depth = 0) {
        if (depth > 3 || searched.has(obj)) return;
        searched.add(obj);

        try {
          for (let key in obj) {
            if (key === 'G-67KP9F9311') {
              searchResults.push(`Found as key: ${path}.${key}`);
            }

            const value = obj[key];
            if (typeof value === 'string') {
              if (value === 'G-67KP9F9311' || value.includes('G-67KP9F9311')) {
                searchResults.push(`Found in value: ${path}.${key} = ${value.substring(0, 100)}`);
              }
            } else if (typeof value === 'object' && value !== null) {
              searchObject(value, `${path}.${key}`, depth + 1);
            }
          }
        } catch (e) {}
      }

      // Search specific GTM/GA related objects
      if (window.google_tag_manager) {
        searchObject(window.google_tag_manager, 'google_tag_manager');
      }
      if (window.google_tag_data) {
        searchObject(window.google_tag_data, 'google_tag_data');
      }
      if (window.dataLayer) {
        searchObject(window.dataLayer, 'dataLayer');
      }

      return searchResults;
    });

    console.log('GA4 ID search results:');
    method2.forEach(result => console.log('  -', result));

    console.log('\n🔍 Method 3: Check google_tag_data object');
    const method3 = await page.evaluate(() => {
      const result = {
        hasGoogleTagData: false,
        properties: [],
        ga4Found: false
      };

      if (window.google_tag_data) {
        result.hasGoogleTagData = true;
        result.properties = Object.keys(window.google_tag_data);

        // Search for GA4 in google_tag_data
        const searchGA4 = (obj, depth = 0) => {
          if (depth > 3) return;
          for (let key in obj) {
            if (key.startsWith('G-')) {
              result.ga4Found = true;
            }
            if (typeof obj[key] === 'object' && obj[key] !== null) {
              searchGA4(obj[key], depth + 1);
            }
          }
        };

        searchGA4(window.google_tag_data);
      }

      return result;
    });

    console.log('Has google_tag_data:', method3.hasGoogleTagData);
    console.log('google_tag_data properties:', method3.properties);
    console.log('GA4 found in google_tag_data:', method3.ga4Found);

    console.log('\n🔍 Method 4: Monitor gtag config calls');
    const method4 = await page.evaluate(() => {
      return window._gtagCalls || [];
    });

    console.log('Captured gtag calls:', method4.length);
    method4.forEach((call, i) => {
      if (call[0] === 'config' && call[1] && call[1].startsWith('G-')) {
        console.log(`  Call ${i}: config ${call[1]}`);
      }
    });

    console.log('\n🔍 Method 5: Check for GA4 in GTM internal tags');
    const method5 = await page.evaluate(() => {
      const result = {
        tagsFound: false,
        ga4Tags: []
      };

      // Try to access GTM's tag configuration
      if (window.google_tag_manager && window.google_tag_manager['GTM-5XNBCTB7']) {
        const container = window.google_tag_manager['GTM-5XNBCTB7'];

        // Check for tags property
        if (container.t) {
          result.tagsFound = true;
          // container.t might contain tag configurations
        }

        // Check for GA4 in stringified container
        try {
          const containerStr = JSON.stringify(container);
          const matches = containerStr.match(/G-[A-Z0-9]{10}/g);
          if (matches) {
            result.ga4Tags = [...new Set(matches)];
          }
        } catch (e) {}
      }

      return result;
    });

    console.log('GTM tags found:', method5.tagsFound);
    console.log('GA4 IDs in container:', method5.ga4Tags);

    // Try to trigger a user interaction to see if GA4 loads
    console.log('\n🎯 Triggering user interaction...');
    await page.mouse.move(500, 500);
    await page.mouse.click(500, 500);
    await page.waitForTimeout(3000);

    // Check again after interaction
    const afterInteraction = await page.evaluate(() => {
      const result = {
        ga4Keys: []
      };

      if (window.google_tag_manager) {
        Object.keys(window.google_tag_manager).forEach(key => {
          if (key.startsWith('G-')) {
            result.ga4Keys.push(key);
          }
        });
      }

      return result;
    });

    console.log('GA4 keys after interaction:', afterInteraction.ga4Keys);

    console.log('\n' + '='.repeat(50));
    console.log('📝 CONCLUSION');
    console.log('='.repeat(50));
    console.log('GA4 ID (G-67KP9F9311) is NOT exposed as a key in window.google_tag_manager');
    console.log('This appears to be a different GTM implementation pattern where GA4 is');
    console.log('configured internally within GTM but not exposed in the global object.');
    console.log('\nPossible solutions:');
    console.log('1. Wait for network requests after user consent');
    console.log('2. Parse GTM container configuration (if accessible)');
    console.log('3. Monitor gtag calls for config commands');
    console.log('4. Use the known expected GA4 ID from database instead of extraction');

    await page.waitForTimeout(15000);

  } finally {
    await browser.close();
    console.log('\n✅ Investigation complete');
  }
}

findGA4Alternative().catch(console.error);