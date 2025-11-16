/**
 * Test AESTURA INTERNATIONAL property with Consent Mode Basic detection fix
 * This is the actual Consent Mode Basic site that should show INFO level
 * Property: [BR] AESTURA (international sites)
 */

import { chromium } from 'playwright';
import { startCapturing, waitForGA4Events, waitForGTMLoad } from './src/modules/networkEventCapturer.js';
import { validateProperty } from './src/modules/configValidator.js';

async function testAesturaInternationalFix() {
  console.log('🧪 Testing AESTURA International (Consent Mode Basic site) with fix\n');
  console.log('Property: [BR] AESTURA');
  console.log('Expected GA4: G-67KP9F9311');
  console.log('Expected GTM: GTM-5R5DPT89 or GTM-5XNBCT');
  console.log('================================================\n');

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  // Test multiple international URLs that use Consent Mode Basic
  const urls = [
    'https://int.aestura.com',
    'https://fr.aestura.com',
    'https://es.aestura.com'
  ];

  for (const url of urls) {
    console.log(`\n🌍 Testing ${url}`);
    console.log('====================================');

    // Property configuration
    const property = {
      propertyName: '[BR] AESTURA',
      measurementId: 'G-67KP9F9311',
      gtmContainerId: 'GTM-5R5DPT89', // or GTM-5XNBCT
      representativeUrl: url,
      hasConsentMode: false
    };

    try {
      // Start capturing network events
      const capturedEvents = [];
      await startCapturing(page, capturedEvents);

      console.log(`📍 Navigating to ${url}...`);
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });

      // Wait for page to load
      console.log('⏳ Waiting for page to load...');
      await page.waitForLoadState('load', { timeout: 20000 }).catch(() => {
        console.log('⚠️ Page load timeout, continuing...');
      });

      // Simulate user interaction
      console.log('🖱️ Simulating user interactions...');
      await page.evaluate(() => {
        window.scrollTo({ top: 300, behavior: 'smooth' });
      });
      await page.waitForTimeout(1000);

      // Check for GA4 events
      console.log('🔍 Checking for GA4 events...');
      const { events, timing } = await waitForGA4Events(page, capturedEvents, property.measurementId);
      console.log(`📊 Found ${events.length} GA4 events`);

      if (events.length === 0) {
        console.log('✅ NO GA4 events detected (expected with Consent Mode Basic)');
      }

      // Check for GTM
      console.log('🔍 Checking for GTM container...');
      const gtmResult = await waitForGTMLoad(page, capturedEvents, property.gtmContainerId, 5000);
      let hasGTM = gtmResult.gtmDetected;

      // Check window.google_tag_manager
      console.log('\n🔍 Checking window.google_tag_manager...');
      const windowCheck = await page.evaluate((expectedGA4Id) => {
        const hasGTMObject = typeof window.google_tag_manager === 'object' && window.google_tag_manager !== null;
        let hasGA4Key = false;

        if (hasGTMObject && expectedGA4Id) {
          hasGA4Key = window.google_tag_manager.hasOwnProperty(expectedGA4Id);
        }

        return {
          hasGTMObject,
          hasGA4Key,
          gtmKeys: hasGTMObject ? Object.keys(window.google_tag_manager).slice(0, 10) : []
        };
      }, property.measurementId);

      console.log(`📦 GTM object exists: ${windowCheck.hasGTMObject}`);
      console.log(`🔑 GA4 ID as key: ${windowCheck.hasGA4Key}`);
      if (windowCheck.hasGTMObject) {
        console.log(`🔑 GTM keys: ${windowCheck.gtmKeys.join(', ')}`);
      }

      // Update hasGTM if window check found it
      hasGTM = hasGTM || windowCheck.hasGTMObject;

      // Check for Consent Mode Basic indicators
      console.log('\n🍪 Checking Consent Mode Basic indicators:');
      const isConsentModeBasic = hasGTM && !windowCheck.hasGA4Key && events.length === 0;
      console.log(`  ✓ GTM loaded: ${hasGTM}`);
      console.log(`  ✓ GA4 NOT in window keys: ${!windowCheck.hasGA4Key}`);
      console.log(`  ✓ NO network events: ${events.length === 0}`);
      console.log(`  → Is Consent Mode Basic: ${isConsentModeBasic ? '✅ YES' : '❌ NO'}`);

      // Prepare validation context
      const validationContext = {
        hasGTM: hasGTM,
        hasGA4InWindow: windowCheck.hasGA4Key,
        networkEvents: events,
        expectedGA4Id: property.measurementId
      };

      // Run validation with context
      console.log('\n🔧 Running validation with Consent Mode Basic detection...');
      const result = await validateProperty(property, events, url, page, timing, validationContext);

      // Display results
      console.log('\n📋 VALIDATION RESULTS:');
      console.log('====================');
      console.log(`✅ Is Valid: ${result.isValid}`);
      console.log(`📊 Issues Found: ${result.issues.length}`);

      if (result.issues.length > 0) {
        console.log('\n🔍 Issues Details:');
        result.issues.forEach(issue => {
          console.log(`\n  Type: ${issue.type}`);
          console.log(`  Severity: ${issue.severity}`);
          console.log(`  Message: ${issue.message}`);
          if (issue.indicators) {
            console.log(`  Indicators: ${issue.indicators.join(', ')}`);
          }
        });
      }

      // Check for Consent Mode Basic detection
      const consentModeIssue = result.issues.find(i => i.type === 'CONSENT_MODE_BASIC_DETECTED');
      if (consentModeIssue) {
        console.log('\n🎯 SUCCESS: Consent Mode Basic detected correctly!');
        console.log('✅ Site is now marked as INFO level, not error');
        console.log('✅ The implementation is working as expected');
      } else if (isConsentModeBasic) {
        console.log('\n❌ PROBLEM: Consent Mode Basic indicators present but NOT detected');
        console.log('⚠️ Site is still showing as error instead of INFO');
      }

      // Check extraction source
      if (result.measurementId?.extractionSource?.consentMode) {
        console.log('\n📊 Consent Mode Details:');
        console.log(`  Type: ${result.measurementId.extractionSource.consentMode.type}`);
        console.log(`  Status: ${result.measurementId.extractionSource.consentMode.status}`);
        console.log(`  Confidence: ${result.measurementId.extractionSource.consentMode.confidence}`);
      }

    } catch (error) {
      console.error(`❌ Test failed for ${url}:`, error);
    }
  }

  await browser.close();
  console.log('\n✅ All tests completed');
}

// Run the test
testAesturaInternationalFix().catch(console.error);