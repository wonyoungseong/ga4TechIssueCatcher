/**
 * Test AESTURA properties in production-like environment
 * Simulating the actual crawler flow
 */

import { chromium } from 'playwright';
import { BrowserPool, createStealthPage } from './src/modules/browserPoolManager.js';
import { validateSingleProperty } from './src/modules/orchestrator.js';

async function testAesturaProduction() {
  console.log('🧪 Testing AESTURA properties with production flow\n');
  console.log('================================================\n');

  // Note: The validateSingleProperty function will call getTempCache internally
  // so we don't need to initialize it ourselves

  // AESTURA properties to test
  const properties = [
    {
      propertyName: '[BR] AESTURA - ES',
      measurementId: 'G-67KP9F9311',
      gtmContainerId: 'GTM-5XNBCT',
      representativeUrl: 'https://es.aestura.com',
      hasConsentMode: false
    },
    {
      propertyName: '[BR] AESTURA - FR',
      measurementId: 'G-67KP9F9311',
      gtmContainerId: 'GTM-5XNBCT',
      representativeUrl: 'https://fr.aestura.com',
      hasConsentMode: false
    }
  ];

  const browserPool = new BrowserPool(2);
  await browserPool.initialize();

  try {
    for (const property of properties) {
      console.log(`\n🌍 Testing ${property.propertyName}`);
      console.log('====================================');
      console.log(`URL: ${property.representativeUrl}`);
      console.log(`Expected GA4: ${property.measurementId}`);
      console.log(`Expected GTM: ${property.gtmContainerId}`);
      console.log('');

      const { browser, index } = await browserPool.acquireBrowser();

      console.log('Browser acquired successfully');
      console.log('Browser type:', typeof browser);
      console.log('Browser constructor:', browser.constructor.name);

      try {
        // Call the actual validation function used in production
        // validateSingleProperty expects: browser, property, dateStr, phase
        const dateStr = new Date().toISOString().split('T')[0];
        const result = await validateSingleProperty(browser, property, dateStr, 1); // Phase 1

        console.log('\n📋 VALIDATION RESULT:');
        console.log(`✅ Is Valid: ${result.isValid}`);
        console.log(`📊 Issues Found: ${result.issues.length}`);

        if (result.issues.length > 0) {
          console.log('\n🔍 Issues:');
          result.issues.forEach(issue => {
            console.log(`  - ${issue.type}: ${issue.message} (${issue.severity})`);
          });
        }

        // Check for Consent Mode Basic
        if (result.measurementId?.extractionSource?.consentMode) {
          console.log('\n🍪 Consent Mode Details:');
          console.log(`  Type: ${result.measurementId.extractionSource.consentMode.type}`);
          console.log(`  Status: ${result.measurementId.extractionSource.consentMode.status}`);
          console.log(`  Confidence: ${result.measurementId.extractionSource.consentMode.confidence}`);
        }

        // Check what type of issue was generated
        const consentModeIssue = result.issues.find(i => i.type === 'CONSENT_MODE_BASIC_DETECTED');
        const pageViewIssue = result.issues.find(i => i.type === 'PAGE_VIEW_NOT_FOUND');

        console.log('\n🎯 DIAGNOSIS:');
        if (consentModeIssue) {
          console.log('✅ SUCCESS: Consent Mode Basic correctly detected as INFO level');
        } else if (pageViewIssue) {
          console.log('❌ PROBLEM: page_view error still showing - Consent Mode Basic not properly detected');
        } else if (result.isValid) {
          console.log('✅ Property is valid (GA4 working normally)');
        } else {
          console.log('❌ Other validation errors detected');
        }

      } catch (error) {
        console.error(`❌ Validation failed: ${error.message}`);
        console.error('Stack:', error.stack);
      } finally {
        await browserPool.releaseBrowser(index);
      }
    }
  } finally {
    await browserPool.cleanup();
  }

  process.exit(0);
}

// Run the test
testAesturaProduction().catch(console.error);