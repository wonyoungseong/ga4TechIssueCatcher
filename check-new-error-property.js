/**
 * Check property with new error: 21d9f68c-6958-4e15-be0e-1c4a2e1cd332
 */

import { chromium } from 'playwright';
import { supabase } from './src/utils/supabase.js';
import { startCapturing, waitForGA4Events, waitForGTMLoad } from './src/modules/networkEventCapturer.js';
import { validateProperty } from './src/modules/configValidator.js';

async function checkProperty() {
  const propertyId = '21d9f68c-6958-4e15-be0e-1c4a2e1cd332';

  console.log('🔍 Checking property with new error');
  console.log('Property ID:', propertyId);
  console.log('================================================\n');

  // Get property details from Supabase
  const { data: property, error } = await supabase
    .from('properties')
    .select('*')
    .eq('id', propertyId)
    .single();

  if (error || !property) {
    console.error('❌ Property not found in database:', error);
    return;
  }

  console.log('📋 Property Details:');
  console.log('  Name:', property.name);
  console.log('  URL:', property.representative_url);
  console.log('  GA4 ID:', property.ga4_measurement_id);
  console.log('  GTM ID:', property.web_gtm_id);
  console.log('  Account:', property.account_name);
  console.log('  Category:', property.category);
  console.log('\n');

  // Get recent crawl results for this property
  const { data: recentResults, error: resultsError } = await supabase
    .from('crawl_results')
    .select('*')
    .eq('property_id', propertyId)
    .order('created_at', { ascending: false })
    .limit(3);

  if (!resultsError && recentResults) {
    console.log('📊 Recent Validation Results:');
    recentResults.forEach((result, index) => {
      console.log(`\n  Result #${index + 1} (${new Date(result.created_at).toISOString()}):`);
      console.log(`    Valid: ${result.is_valid}`);
      if (result.issues && result.issues.length > 0) {
        console.log('    Issues:');
        result.issues.forEach(issue => {
          console.log(`      - ${issue.type}: ${issue.message} (${issue.severity})`);
        });
      }
    });
    console.log('\n');
  }

  // Now test the property with our browser automation
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  try {
    // Property configuration
    const testProperty = {
      propertyName: property.name,
      measurementId: property.ga4_measurement_id,
      gtmContainerId: property.web_gtm_id,
      representativeUrl: property.representative_url,
      hasConsentMode: false
    };

    // Start capturing network events
    const capturedEvents = [];
    await startCapturing(page, capturedEvents);

    console.log(`📍 Navigating to ${testProperty.representativeUrl}...`);

    // Check if the URL is valid
    try {
      await page.goto(testProperty.representativeUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });
    } catch (navError) {
      console.error('❌ Navigation error:', navError.message);
      await browser.close();
      return;
    }

    // Wait for page to load
    console.log('⏳ Waiting for page to load...');
    await page.waitForLoadState('load', { timeout: 20000 }).catch(() => {
      console.log('⚠️ Page load timeout, continuing...');
    });

    // Check for service closure or errors
    const pageContent = await page.content();
    const pageTitle = await page.title();
    console.log('📄 Page title:', pageTitle);

    // Check for Korean/English service closure patterns
    const closurePatterns = [
      /서비스\s*종료/i,
      /사이트\s*폐쇄/i,
      /service\s*closed/i,
      /site\s*closed/i,
      /no\s*longer\s*available/i,
      /404/,
      /not\s*found/i
    ];

    const hasClosurePattern = closurePatterns.some(pattern =>
      pattern.test(pageContent) || pattern.test(pageTitle)
    );

    if (hasClosurePattern) {
      console.log('⚠️ Service closure detected!');
    }

    // Simulate user interaction
    console.log('🖱️ Simulating user interactions...');
    await page.evaluate(() => {
      window.scrollTo({ top: 300, behavior: 'smooth' });
    });
    await page.waitForTimeout(1000);

    // Check for GA4 events
    console.log('🔍 Checking for GA4 events...');
    const { events, timing } = await waitForGA4Events(page, capturedEvents, testProperty.measurementId);
    console.log(`📊 Found ${events.length} GA4 events`);

    // Check for GTM
    console.log('🔍 Checking for GTM container...');
    let hasGTM = false;
    if (testProperty.gtmContainerId) {
      const gtmResult = await waitForGTMLoad(page, capturedEvents, testProperty.gtmContainerId, 5000);
      hasGTM = gtmResult.gtmDetected;
      console.log(`🏷️ GTM detected: ${hasGTM}`);
      if (gtmResult.gtmIds.length > 0) {
        console.log(`🏷️ GTM IDs found: ${gtmResult.gtmIds.join(', ')}`);
      }
    }

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
    }, testProperty.measurementId);

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
      expectedGA4Id: testProperty.measurementId
    };

    // Run validation with context
    console.log('\n🔧 Running validation with Consent Mode Basic detection...');
    const result = await validateProperty(testProperty, events, testProperty.representativeUrl, page, timing, validationContext);

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
        console.log(`  Expected: ${issue.expected}`);
        console.log(`  Actual: ${issue.actual}`);
        if (issue.indicators) {
          console.log(`  Indicators: ${issue.indicators.join(', ')}`);
        }
      });
    }

    // Check what type of issue this is
    console.log('\n🎯 DIAGNOSIS:');
    if (hasClosurePattern) {
      console.log('❌ The site appears to be closed or unavailable');
    } else if (isConsentModeBasic) {
      console.log('ℹ️ This is a Consent Mode Basic site - GA4 is configured but blocked until user consent');
    } else if (events.length === 0) {
      console.log('❌ No GA4 events detected - GA4 may not be installed');
    } else if (!result.isValid) {
      console.log('❌ GA4 is installed but configuration mismatch detected');
    } else {
      console.log('✅ GA4 is properly configured and working');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await browser.close();
    process.exit(0);
  }
}

// Run the check
checkProperty().catch(console.error);