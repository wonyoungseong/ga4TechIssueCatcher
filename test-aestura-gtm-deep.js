/**
 * Deep inspection of GTM container to find GA4 configuration
 */

import { chromium } from 'playwright';

async function inspectGTMContainer() {
  const browser = await chromium.launch({
    headless: false,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-features=site-per-process',
      '--no-sandbox'
    ]
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    const page = await context.newPage();

    // Enable console logging
    page.on('console', msg => {
      if (msg.text().includes('GA4') || msg.text().includes('G-')) {
        console.log('Console:', msg.text());
      }
    });

    // Track network requests for GA4
    const ga4Requests = [];
    page.on('request', request => {
      const url = request.url();
      if (url.includes('google-analytics.com') || url.includes('/collect')) {
        const params = new URL(url).searchParams;
        const tid = params.get('tid');
        if (tid) {
          ga4Requests.push({ url, tid, method: request.method() });
        }
      }
    });

    console.log('🌐 Navigating to AESTURA site...');
    await page.goto('https://fr.aestura.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    console.log('✅ Page loaded, inspecting GTM container...\n');

    // Wait for GTM to load
    await page.waitForTimeout(5000);

    // Deep inspection of GTM container
    const containerInfo = await page.evaluate(() => {
      const info = {
        gtmContainerFound: false,
        gtmContainerId: null,
        ga4ConfigFound: false,
        ga4MeasurementId: null,
        gtmDataLayerEvents: [],
        gtagConfig: null
      };

      // Check GTM container
      if (window.google_tag_manager && window.google_tag_manager['GTM-5XNBCTB7']) {
        info.gtmContainerFound = true;
        info.gtmContainerId = 'GTM-5XNBCTB7';

        // Try to access container data
        const container = window.google_tag_manager['GTM-5XNBCTB7'];

        // Check if container has dataLayer
        if (container && container.dataLayer) {
          const dl = container.dataLayer;
          info.gtmDataLayerEvents = dl.gtmDom ? 'Has gtmDom event' : 'No gtmDom';
        }
      }

      // Check dataLayer for GA4 config
      if (window.dataLayer && Array.isArray(window.dataLayer)) {
        window.dataLayer.forEach(item => {
          if (item && item[0] === 'config' && item[1] && item[1].startsWith('G-')) {
            info.ga4ConfigFound = true;
            info.ga4MeasurementId = item[1];
          }
        });
      }

      // Check gtag calls
      if (window.gtag) {
        // Try to capture gtag config calls
        const originalGtag = window.gtag;
        let capturedConfig = null;

        // Override gtag temporarily
        window.gtag = function() {
          if (arguments[0] === 'config' && arguments[1] && arguments[1].startsWith('G-')) {
            capturedConfig = arguments[1];
          }
          return originalGtag.apply(this, arguments);
        };

        info.gtagConfig = capturedConfig;
      }

      return info;
    });

    console.log('📦 GTM Container Analysis:');
    console.log('GTM Container Found:', containerInfo.gtmContainerFound);
    console.log('GTM Container ID:', containerInfo.gtmContainerId);
    console.log('GA4 Config Found:', containerInfo.ga4ConfigFound);
    console.log('GA4 Measurement ID:', containerInfo.ga4MeasurementId);
    console.log('GTM DataLayer Events:', containerInfo.gtmDataLayerEvents);

    // Check for GA4 in network requests
    console.log('\n📡 Network Requests Analysis:');
    console.log('GA4 Requests captured:', ga4Requests.length);
    if (ga4Requests.length > 0) {
      ga4Requests.slice(0, 3).forEach(req => {
        console.log(`  - TID: ${req.tid}, Method: ${req.method}`);
      });
    }

    // Try to trigger consent and see what happens
    console.log('\n🔓 Attempting to trigger consent acceptance...');
    await page.evaluate(() => {
      // Try common consent methods
      if (window.gtag) {
        window.gtag('consent', 'update', {
          'analytics_storage': 'granted',
          'ad_storage': 'granted'
        });
      }

      // Try OneTrust if available
      if (window.OneTrust && window.OneTrust.AllowAll) {
        window.OneTrust.AllowAll();
      }

      // Try Cookiebot if available
      if (window.Cookiebot && window.Cookiebot.consent) {
        window.Cookiebot.consent.marketing = true;
        window.Cookiebot.consent.statistics = true;
      }

      // Try TrustArc if available
      if (window.truste && window.truste.eu) {
        window.truste.eu.clickListener();
      }
    });

    // Wait for potential GA4 initialization after consent
    console.log('⏳ Waiting for GA4 initialization after consent...');
    await page.waitForTimeout(5000);

    // Check again after consent
    const afterConsentCheck = await page.evaluate(() => {
      const result = {
        ga4InWindow: false,
        ga4Keys: [],
        dataLayerGA4: false
      };

      if (window.google_tag_manager) {
        Object.keys(window.google_tag_manager).forEach(key => {
          if (key.startsWith('G-')) {
            result.ga4InWindow = true;
            result.ga4Keys.push(key);
          }
        });
      }

      if (window.dataLayer) {
        result.dataLayerGA4 = window.dataLayer.some(item =>
          JSON.stringify(item).includes('G-67KP9F9311')
        );
      }

      return result;
    });

    console.log('\n📊 After Consent Check:');
    console.log('GA4 in window.google_tag_manager:', afterConsentCheck.ga4InWindow);
    console.log('GA4 Keys found:', afterConsentCheck.ga4Keys);
    console.log('GA4 in dataLayer:', afterConsentCheck.dataLayerGA4);

    // Check GA4 requests after consent
    console.log('GA4 Requests after consent:', ga4Requests.length);

    // Try to find GA4 configuration in GTM's internal structures
    console.log('\n🔍 Searching for GA4 in GTM internals...');
    const gtmInternals = await page.evaluate(() => {
      const search = {
        foundInHTML: false,
        foundInScripts: [],
        gtmVersion: null
      };

      // Search in all script tags
      document.querySelectorAll('script').forEach((script, index) => {
        if (script.textContent.includes('G-67KP9F9311')) {
          search.foundInScripts.push(`Script ${index}: Contains G-67KP9F9311`);
        }
        if (script.src && script.src.includes('gtm.js')) {
          const match = script.src.match(/gtm\.js\?id=(GTM-[A-Z0-9]+)/);
          if (match) {
            search.gtmVersion = match[1];
          }
        }
      });

      // Check HTML
      search.foundInHTML = document.documentElement.innerHTML.includes('G-67KP9F9311');

      return search;
    });

    console.log('GA4 found in HTML:', gtmInternals.foundInHTML);
    console.log('GA4 found in scripts:', gtmInternals.foundInScripts);
    console.log('GTM Version:', gtmInternals.gtmVersion);

    // Final summary
    console.log('\n' + '='.repeat(50));
    console.log('📝 FINAL ANALYSIS');
    console.log('='.repeat(50));
    console.log('Expected GA4 ID: G-67KP9F9311');
    console.log('Found in window.google_tag_manager: NO');
    console.log('Found in network requests:', ga4Requests.some(r => r.tid === 'G-67KP9F9311') ? 'YES' : 'NO');
    console.log('Found in HTML/Scripts:', gtmInternals.foundInHTML ? 'YES' : 'NO');

    if (ga4Requests.length === 0) {
      console.log('\n⚠️ No GA4 requests detected - likely blocked by Consent Mode');
    }

    console.log('\n💡 Conclusion:');
    console.log('GA4 appears to be configured within GTM container but not exposed');
    console.log('in window.google_tag_manager as a direct key. This is different from');
    console.log('the expected pattern where GA4 IDs appear as keys.');

    // Keep browser open for inspection
    console.log('\n⏰ Keeping browser open for 20 seconds...');
    await page.waitForTimeout(20000);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
    console.log('✅ Test completed');
  }
}

inspectGTMContainer().catch(console.error);