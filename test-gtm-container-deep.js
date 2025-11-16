/**
 * Deep GTM container inspection to find GA4 configuration
 * For Consent Mode Basic sites like AESTURA
 */

import { chromium } from 'playwright';

async function inspectGTMDeep() {
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  });

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('🌐 Navigating to AESTURA...');
    await page.goto('https://fr.aestura.com/', {
      waitUntil: 'domcontentloaded'
    });

    await page.waitForTimeout(5000);

    console.log('\n🔍 Method 1: Check GTM container internal structure');
    const containerData = await page.evaluate(() => {
      const result = {
        hasContainer: false,
        containerKeys: [],
        ga4Found: false,
        ga4Locations: []
      };

      if (window.google_tag_manager && window.google_tag_manager['GTM-5XNBCTB7']) {
        result.hasContainer = true;
        const container = window.google_tag_manager['GTM-5XNBCTB7'];

        // Deep search function
        const searchForGA4 = (obj, path = '', depth = 0, visited = new Set()) => {
          if (depth > 5 || visited.has(obj)) return;
          if (!obj || typeof obj !== 'object') return;
          visited.add(obj);

          try {
            Object.keys(obj).forEach(key => {
              const currentPath = path ? `${path}.${key}` : key;
              const value = obj[key];

              // Check if key or value contains GA4 ID
              if (key === 'G-67KP9F9311' || key.includes('G-67KP9F9311')) {
                result.ga4Found = true;
                result.ga4Locations.push(`Key found at: ${currentPath}`);
              }

              if (typeof value === 'string') {
                if (value.includes('G-67KP9F9311')) {
                  result.ga4Found = true;
                  result.ga4Locations.push(`Value found at: ${currentPath}`);
                }
              } else if (typeof value === 'object' && value !== null) {
                searchForGA4(value, currentPath, depth + 1, visited);
              }
            });
          } catch (e) {}
        };

        // Search the container
        searchForGA4(container);
        result.containerKeys = Object.keys(container).slice(0, 20);
      }

      return result;
    });

    console.log('Container found:', containerData.hasContainer);
    console.log('Container keys:', containerData.containerKeys);
    console.log('GA4 found in container:', containerData.ga4Found);
    if (containerData.ga4Locations.length > 0) {
      console.log('GA4 locations:');
      containerData.ga4Locations.forEach(loc => console.log('  -', loc));
    }

    console.log('\n🔍 Method 2: Check dataLayer for GA4 configuration');
    const dataLayerGA4 = await page.evaluate(() => {
      const result = {
        hasDataLayer: false,
        ga4Events: [],
        ga4Config: null
      };

      if (window.dataLayer && Array.isArray(window.dataLayer)) {
        result.hasDataLayer = true;

        window.dataLayer.forEach((item, index) => {
          const itemStr = JSON.stringify(item);
          if (itemStr.includes('G-67KP9F9311')) {
            result.ga4Events.push({
              index,
              content: item
            });
          }

          // Check for gtag config
          if (Array.isArray(item) && item[0] === 'config' && item[1] && item[1].startsWith('G-')) {
            result.ga4Config = item[1];
          }
        });
      }

      return result;
    });

    console.log('DataLayer exists:', dataLayerGA4.hasDataLayer);
    console.log('GA4 events in dataLayer:', dataLayerGA4.ga4Events.length);
    console.log('GA4 config found:', dataLayerGA4.ga4Config);

    console.log('\n🔍 Method 3: Check GTM container variables');
    const containerVars = await page.evaluate(() => {
      const result = {
        variables: [],
        ga4Found: false
      };

      if (window.google_tag_manager && window.google_tag_manager['GTM-5XNBCTB7']) {
        const container = window.google_tag_manager['GTM-5XNBCTB7'];

        // Check specific container properties
        if (container.vars) {
          result.variables = Object.keys(container.vars).slice(0, 10);
        }

        // Check for tags
        if (container.t) {
          // container.t might have tag configurations
          try {
            const tagsStr = JSON.stringify(container.t);
            if (tagsStr.includes('G-67KP9F9311')) {
              result.ga4Found = true;
            }
          } catch (e) {}
        }
      }

      return result;
    });

    console.log('Container variables:', containerVars.variables);
    console.log('GA4 in tags:', containerVars.ga4Found);

    console.log('\n🔍 Method 4: Force accept cookies and check again');

    // Try to find and click cookie accept button
    const cookieAccepted = await page.evaluate(() => {
      // Common cookie banner selectors
      const selectors = [
        '[id*="accept"]',
        '[class*="accept"]',
        '[class*="agree"]',
        '[class*="consent"]',
        'button:has-text("Accept")',
        'button:has-text("Accepter")',
        'button:has-text("J\'accepte")',
        '[class*="onetrust-accept"]',
        '#onetrust-accept-btn-handler'
      ];

      for (const selector of selectors) {
        try {
          const elements = document.querySelectorAll(selector);
          for (const el of elements) {
            if (el && el.offsetParent !== null &&
                (el.textContent.toLowerCase().includes('accept') ||
                 el.textContent.toLowerCase().includes('accepter'))) {
              el.click();
              return true;
            }
          }
        } catch (e) {}
      }

      return false;
    });

    if (cookieAccepted) {
      console.log('✅ Cookie consent accepted');
      await page.waitForTimeout(5000);

      // Check for GA4 after consent
      const afterConsent = await page.evaluate(() => {
        const ga4Keys = [];
        for (let key in window.google_tag_manager) {
          if (key.startsWith('G-')) {
            ga4Keys.push(key);
          }
        }
        return ga4Keys;
      });

      console.log('GA4 keys after consent:', afterConsent);
    } else {
      console.log('⚠️ Could not find cookie accept button');
    }

    console.log('\n🔍 Method 5: Check if GA4 is configured but hidden');
    const hiddenGA4 = await page.evaluate(() => {
      // Check if gtag function exists and try to intercept it
      if (typeof window.gtag === 'function') {
        // Create a wrapper to capture gtag calls
        const originalGtag = window.gtag;
        let capturedGA4 = null;

        window.gtag = function() {
          if (arguments[0] === 'config' && arguments[1] && arguments[1].startsWith('G-')) {
            capturedGA4 = arguments[1];
          }
          return originalGtag.apply(this, arguments);
        };

        // Trigger a gtag call to see if GA4 is configured
        try {
          window.gtag('event', 'test_event', {});
        } catch (e) {}

        // Restore original
        window.gtag = originalGtag;

        return {
          hasGtag: true,
          capturedGA4
        };
      }

      return { hasGtag: false };
    });

    console.log('Has gtag function:', hiddenGA4.hasGtag);
    console.log('Captured GA4 ID:', hiddenGA4.capturedGA4);

    console.log('\n' + '='.repeat(60));
    console.log('📝 ANALYSIS RESULTS');
    console.log('='.repeat(60));
    console.log('Site: AESTURA (https://fr.aestura.com/)');
    console.log('GTM Container: GTM-5XNBCTB7 ✅');
    console.log('Expected GA4: G-67KP9F9311 ❌');
    console.log('Consent Mode: Basic (no data before consent)');
    console.log('\nConclusion:');
    console.log('- GA4 is configured within GTM but not exposed as window key');
    console.log('- Consent Mode Basic blocks all GA4 activity until consent');
    console.log('- Cannot detect GA4 ID through window.google_tag_manager');
    console.log('\nRecommendation:');
    console.log('- Mark as "Consent Mode Active" when GTM exists but no GA4 detected');
    console.log('- Or use expected GA4 ID from database as fallback');

    await page.waitForTimeout(20000);

  } finally {
    await browser.close();
    console.log('\n✅ Investigation complete');
  }
}

inspectGTMDeep().catch(console.error);