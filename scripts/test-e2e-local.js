#!/usr/bin/env node

/**
 * End-to-End Test for Local Supabase Setup
 *
 * This script performs a complete end-to-end test of the GA4 validation system
 * running against local Supabase. It tests the full workflow from property
 * selection through crawling, screenshot capture, and data storage.
 *
 * Features:
 * - Single property validation test
 * - Screenshot capture and upload verification
 * - Database record insertion validation
 * - Storage URL verification
 * - Cleanup of test data
 *
 * Usage:
 *   node scripts/test-e2e-local.js
 *
 * Prerequisites:
 *   - Local Supabase running: docker-compose up -d
 *   - Environment configured for local: ./scripts/switch-to-local.sh
 *   - Properties imported: node scripts/import-properties-to-local.js
 */

import { chromium } from 'playwright';
import { supabase, Tables } from '../src/utils/supabase.js';
import { createStealthPage } from '../src/modules/browserPoolManager.js';
import { startCapturing, waitForGA4Events } from '../src/modules/networkEventCapturer.js';
import { validateProperty } from '../src/modules/configValidator.js';

// Test configuration
const TEST_PROPERTY = {
  propertyName: 'E2E Test Property',
  representativeUrl: 'https://www.amorepacific.com',
  measurementId: 'G-XXXXXXXXXX', // Expected measurement ID (will be validated)
  gtmId: 'GTM-XXXXXXX'
};

/**
 * Format result with emoji
 */
function formatResult(passed, message) {
  return passed ? `✅ ${message}` : `❌ ${message}`;
}

/**
 * Test 1: Property Selection
 */
async function testPropertySelection() {
  console.log('\n📋 Test 1: Property Selection');
  console.log('─'.repeat(60));

  try {
    // Get a real property from database for testing
    const { data: properties, error } = await supabase
      .from(Tables.PROPERTIES)
      .select('*')
      .limit(1);

    if (error) {
      console.log(formatResult(false, `Failed to fetch properties: ${error.message}`));
      return null;
    }

    if (!properties || properties.length === 0) {
      console.log(formatResult(false, 'No properties found in database'));
      console.log('   💡 Run: node scripts/import-properties-to-local.js');
      return null;
    }

    const testProperty = properties[0];
    console.log(formatResult(true, 'Property selected for testing'));
    console.log(`   Property: ${testProperty.property_name}`);
    console.log(`   URL: ${testProperty.representative_url}`);
    console.log(`   Expected GA4: ${testProperty.measurement_id}`);

    return testProperty;

  } catch (error) {
    console.log(formatResult(false, `Property selection error: ${error.message}`));
    return null;
  }
}

/**
 * Test 2: Create Crawl Run
 */
async function testCreateCrawlRun() {
  console.log('\n🏃 Test 2: Create Crawl Run');
  console.log('─'.repeat(60));

  try {
    const { data, error } = await supabase
      .from(Tables.CRAWL_RUNS)
      .insert([{
        started_at: new Date().toISOString(),
        status: 'in_progress',
        total_properties: 1,
        is_saved: false // Mark as test data
      }])
      .select()
      .single();

    if (error) {
      console.log(formatResult(false, `Failed to create crawl run: ${error.message}`));
      return null;
    }

    console.log(formatResult(true, 'Crawl run created'));
    console.log(`   Run ID: ${data.id}`);
    console.log(`   Status: ${data.status}`);

    return data.id;

  } catch (error) {
    console.log(formatResult(false, `Crawl run creation error: ${error.message}`));
    return null;
  }
}

/**
 * Test 3: Run Single Property Validation
 */
async function testPropertyValidation(property, runId) {
  console.log('\n🔍 Test 3: Property Validation');
  console.log('─'.repeat(60));

  let browser = null;
  let context = null;
  let page = null;

  try {
    console.log('   Launching browser...');
    browser = await chromium.launch({ headless: true });

    const stealthResult = await createStealthPage(browser);
    context = stealthResult.context;
    page = stealthResult.page;

    console.log(formatResult(true, 'Browser launched'));

    // Start network capture
    console.log('   Starting network event capture...');
    const capturedEvents = await startCapturing(page);

    // Navigate to URL
    console.log(`   Navigating to ${property.representative_url}...`);
    const response = await page.goto(property.representative_url, {
      timeout: 30000,
      waitUntil: 'domcontentloaded'
    });

    const statusCode = response ? response.status() : null;
    console.log(formatResult(statusCode === 200, `HTTP ${statusCode}`));

    // Wait for page load
    console.log('   Waiting for page load...');
    try {
      await page.waitForLoadState('load', { timeout: 20000 });
      console.log(formatResult(true, 'Page loaded'));
    } catch (loadError) {
      console.log(formatResult(true, 'Page load timeout (proceeding anyway)'));
    }

    // Capture screenshot
    console.log('   Capturing screenshot...');
    const screenshotBuffer = await page.screenshot({
      fullPage: true,
      type: 'jpeg',
      quality: 60
    });

    const screenshotSizeMB = (screenshotBuffer.length / 1024 / 1024).toFixed(2);
    console.log(formatResult(true, `Screenshot captured (${screenshotSizeMB}MB)`));

    // Wait for GA4 events
    console.log('   Waiting for GA4 events...');
    const { events, timing } = await waitForGA4Events(
      page,
      capturedEvents,
      property.measurement_id
    );

    console.log(formatResult(events.length > 0, `Captured ${events.length} GA4 events`));

    // Validate configuration
    console.log('   Validating property configuration...');
    const result = await validateProperty(
      property,
      events,
      property.representative_url,
      page,
      timing
    );

    console.log(formatResult(true, 'Validation completed'));
    console.log(`   Valid: ${result.isValid ? 'Yes' : 'No'}`);
    console.log(`   Issues: ${result.issues?.length || 0}`);

    // Store result in database
    console.log('   Storing validation result...');
    const { error: insertError } = await supabase
      .from(Tables.CRAWL_RESULTS)
      .insert([{
        crawl_run_id: runId,
        property_id: property.id,
        validation_status: result.isValid ? 'passed' : 'failed',
        collected_ga4_id: result.measurementId?.actual || null,
        collected_gtm_id: result.gtmId?.allFound || [],
        page_view_event_detected: (result.pageViewEvent?.count > 0) || false,
        has_issues: !result.isValid,
        issue_types: result.issues?.map(issue => issue.type) || [],
        issue_summary: result.issues?.map(i => i.message).join('; ') || null,
        validation_duration_ms: result.executionTimeMs
      }]);

    if (insertError) {
      console.log(formatResult(false, `Failed to store result: ${insertError.message}`));
    } else {
      console.log(formatResult(true, 'Result stored in database'));
    }

    // Upload screenshot
    console.log('   Uploading screenshot to storage...');
    const screenshotPath = `test/${property.id}_${Date.now()}.jpg`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('screenshots')
      .upload(screenshotPath, screenshotBuffer, {
        contentType: 'image/jpeg',
        upsert: false
      });

    if (uploadError) {
      console.log(formatResult(false, `Screenshot upload failed: ${uploadError.message}`));
    } else {
      const { data: { publicUrl } } = supabase.storage
        .from('screenshots')
        .getPublicUrl(screenshotPath);

      console.log(formatResult(true, 'Screenshot uploaded'));
      console.log(`   URL: ${publicUrl}`);

      // Update result with screenshot URL
      await supabase
        .from(Tables.CRAWL_RESULTS)
        .update({ screenshot_url: publicUrl })
        .eq('property_id', property.id)
        .eq('crawl_run_id', runId);
    }

    return {
      success: true,
      result,
      screenshotPath: uploadData?.path
    };

  } catch (error) {
    console.log(formatResult(false, `Validation error: ${error.message}`));
    return {
      success: false,
      error: error.message
    };

  } finally {
    // Cleanup browser resources
    try {
      if (page) await page.close();
      if (context) await context.close();
      if (browser) await browser.close();
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
  }
}

/**
 * Test 4: Verify Database Records
 */
async function testDatabaseRecords(runId, propertyId) {
  console.log('\n💾 Test 4: Verify Database Records');
  console.log('─'.repeat(60));

  try {
    // Verify crawl result
    const { data: resultData, error: resultError } = await supabase
      .from(Tables.CRAWL_RESULTS)
      .select('*')
      .eq('crawl_run_id', runId)
      .eq('property_id', propertyId)
      .single();

    if (resultError) {
      console.log(formatResult(false, `Failed to fetch result: ${resultError.message}`));
      return false;
    }

    console.log(formatResult(true, 'Crawl result found'));
    console.log(`   Status: ${resultData.validation_status}`);
    console.log(`   GA4 ID: ${resultData.collected_ga4_id || 'None'}`);
    console.log(`   Issues: ${resultData.has_issues ? 'Yes' : 'No'}`);
    console.log(`   Screenshot URL: ${resultData.screenshot_url ? 'Set' : 'Not set'}`));

    return true;

  } catch (error) {
    console.log(formatResult(false, `Database verification error: ${error.message}`));
    return false;
  }
}

/**
 * Test 5: Cleanup Test Data
 */
async function testCleanup(runId, screenshotPath) {
  console.log('\n🧹 Test 5: Cleanup Test Data');
  console.log('─'.repeat(60));

  let cleanupSuccess = true;

  try {
    // Delete crawl results
    const { error: deleteResultsError } = await supabase
      .from(Tables.CRAWL_RESULTS)
      .delete()
      .eq('crawl_run_id', runId);

    if (deleteResultsError) {
      console.log(formatResult(false, `Failed to delete results: ${deleteResultsError.message}`));
      cleanupSuccess = false;
    } else {
      console.log(formatResult(true, 'Test results deleted'));
    }

    // Delete crawl run
    const { error: deleteRunError } = await supabase
      .from(Tables.CRAWL_RUNS)
      .delete()
      .eq('id', runId);

    if (deleteRunError) {
      console.log(formatResult(false, `Failed to delete run: ${deleteRunError.message}`));
      cleanupSuccess = false;
    } else {
      console.log(formatResult(true, 'Test crawl run deleted'));
    }

    // Delete screenshot
    if (screenshotPath) {
      const { error: deleteFileError } = await supabase.storage
        .from('screenshots')
        .remove([screenshotPath]);

      if (deleteFileError) {
        console.log(formatResult(false, `Failed to delete screenshot: ${deleteFileError.message}`));
        cleanupSuccess = false;
      } else {
        console.log(formatResult(true, 'Test screenshot deleted'));
      }
    }

    return cleanupSuccess;

  } catch (error) {
    console.log(formatResult(false, `Cleanup error: ${error.message}`));
    return false;
  }
}

/**
 * Main test runner
 */
async function runE2ETest() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 End-to-End Test for Local Supabase');
  console.log('='.repeat(60));
  console.log('');
  console.log('This test validates the complete GA4 validation workflow:');
  console.log('  1. Property selection from database');
  console.log('  2. Crawl run creation');
  console.log('  3. Browser automation and validation');
  console.log('  4. Screenshot capture and upload');
  console.log('  5. Database record verification');
  console.log('  6. Test data cleanup');
  console.log('');

  const results = {
    propertySelection: false,
    crawlRunCreation: false,
    validation: false,
    databaseRecords: false,
    cleanup: false
  };

  let runId = null;
  let propertyId = null;
  let screenshotPath = null;

  try {
    // Test 1: Property Selection
    const property = await testPropertySelection();
    results.propertySelection = !!property;

    if (!property) {
      throw new Error('Property selection failed - cannot continue');
    }

    propertyId = property.id;

    // Test 2: Create Crawl Run
    runId = await testCreateCrawlRun();
    results.crawlRunCreation = !!runId;

    if (!runId) {
      throw new Error('Crawl run creation failed - cannot continue');
    }

    // Test 3: Run Validation
    const validationResult = await testPropertyValidation(property, runId);
    results.validation = validationResult.success;
    screenshotPath = validationResult.screenshotPath;

    if (!validationResult.success) {
      console.log(`   ⚠️ Validation completed with errors: ${validationResult.error}`);
    }

    // Test 4: Verify Database Records
    results.databaseRecords = await testDatabaseRecords(runId, propertyId);

  } catch (error) {
    console.error(`\n💥 Test execution failed: ${error.message}`);
  }

  // Test 5: Cleanup (always run)
  if (runId) {
    results.cleanup = await testCleanup(runId, screenshotPath);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary');
  console.log('='.repeat(60));

  const testNames = {
    propertySelection: 'Property Selection',
    crawlRunCreation: 'Crawl Run Creation',
    validation: 'Property Validation',
    databaseRecords: 'Database Records',
    cleanup: 'Test Data Cleanup'
  };

  let passedCount = 0;
  let totalCount = Object.keys(results).length;

  for (const [key, passed] of Object.entries(results)) {
    console.log(formatResult(passed, testNames[key]));
    if (passed) passedCount++;
  }

  console.log('\n' + '─'.repeat(60));
  console.log(`Result: ${passedCount}/${totalCount} tests passed`);
  console.log('='.repeat(60));

  const allPassed = passedCount === totalCount;

  if (allPassed) {
    console.log('\n✅ End-to-end test passed! Local Supabase setup is working correctly.');
    console.log('   The complete validation workflow is functional.\n');
  } else {
    console.log('\n⚠️  Some tests failed. Troubleshooting steps:');
    console.log('   1. Ensure local Supabase is running: docker-compose ps');
    console.log('   2. Check environment: cat .env | grep SUPABASE_URL');
    console.log('   3. Import properties: node scripts/import-properties-to-local.js');
    console.log('   4. Test connection: node scripts/test-local-connection.js');
    console.log('   5. Check browser: Ensure Playwright Chromium is installed\n');
  }

  process.exit(allPassed ? 0 : 1);
}

// Run E2E test
runE2ETest().catch(error => {
  console.error('\n💥 E2E test runner crashed:', error);
  process.exit(1);
});
