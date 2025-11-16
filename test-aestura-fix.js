/**
 * Test AESTURA property with Consent Mode Basic detection fix
 * Property ID: 96063723-4358-455c-9ac0-fe00d17d95e7
 */

import { chromium } from 'playwright';
import { startCapturing, waitForGA4Events, waitForGTMLoad } from './src/modules/networkEventCapturer.js';
import { validateProperty } from './src/modules/configValidator.js';

async function testAesturaFix() {
  console.log('🧪 Testing AESTURA with Consent Mode Basic detection fix\n');
  console.log('Property ID: 96063723-4358-455c-9ac0-fe00d17d95e7');
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

  // Property configuration from CSV
  const property = {
    propertyName: 'AESTURA',
    measurementId: 'G-67KP9F9311',
    gtmContainerId: 'GTM-MDXH8HL',
    representativeUrl: 'https://aestura.com',
    hasConsentMode: false
  };

  try {
    // Start capturing network events
    const capturedEvents = [];
    await startCapturing(page, capturedEvents);

    console.log(`📍 Navigating to ${property.representativeUrl}...`);
    await page.goto(property.representativeUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    // Wait for page to load
    console.log('⏳ Waiting for page to load...');
    await page.waitForLoadState('load', { timeout: 20000 }).catch(() => {
      console.log('⚠️ Page load timeout, continuing...');
    });

    // Simulate user interaction (triggers lazy loaders)
    console.log('🖱️ Simulating user interactions...');
    await page.evaluate(() => {
      window.scrollTo({ top: 300, behavior: 'smooth' });
    });
    await page.waitForTimeout(1000);

    // Check for GA4 events
    console.log('🔍 Checking for GA4 events...');
    const { events, timing } = await waitForGA4Events(page, capturedEvents, property.measurementId);
    console.log(`📊 Found ${events.length} GA4 events`);

    // Check for GTM
    console.log('🔍 Checking for GTM container...');
    const gtmResult = await waitForGTMLoad(page, capturedEvents, property.gtmContainerId, 5000);
    const hasGTM = gtmResult.gtmDetected;
    console.log(`🏷️ GTM detected: ${hasGTM}`);

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

    console.log(`✅ GTM object exists: ${windowCheck.hasGTMObject}`);
    console.log(`❌ GA4 ID as key: ${windowCheck.hasGA4Key}`);
    if (windowCheck.hasGTMObject) {
      console.log(`🔑 GTM keys: ${windowCheck.gtmKeys.join(', ')}`);
    }

    // Prepare validation context
    const validationContext = {
      hasGTM: hasGTM || windowCheck.hasGTMObject,
      hasGA4InWindow: windowCheck.hasGA4Key,
      networkEvents: events,
      expectedGA4Id: property.measurementId
    };

    // Run validation with context
    console.log('\n🔧 Running validation with Consent Mode Basic detection...');
    const result = await validateProperty(property, events, property.representativeUrl, page, timing, validationContext);

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
      console.log('✅ AESTURA is now marked as INFO level, not error');
      console.log('✅ The implementation is working as expected');
    } else {
      console.log('\n❌ PROBLEM: Consent Mode Basic was NOT detected');
      console.log('⚠️ AESTURA is still showing as error instead of INFO');
    }

    // Check extraction source
    if (result.measurementId?.extractionSource?.consentMode) {
      console.log('\n📊 Consent Mode Details:');
      console.log(`  Type: ${result.measurementId.extractionSource.consentMode.type}`);
      console.log(`  Status: ${result.measurementId.extractionSource.consentMode.status}`);
      console.log(`  Confidence: ${result.measurementId.extractionSource.consentMode.confidence}`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await browser.close();
  }
}

// Run the test
testAesturaFix().catch(console.error);