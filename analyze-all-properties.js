/**
 * Analyze all validation results to find all GA4 properties on each page
 */

import fs from 'fs/promises';
import path from 'path';

const RESULTS_DIR = './results/2025-10-30';

async function analyzeAllProperties() {
  try {
    // Read all JSON files
    const files = await fs.readdir(RESULTS_DIR);
    const jsonFiles = files.filter(f =>
      f.endsWith('.json') &&
      !f.startsWith('_')
    );

    console.log(`\n📊 Analyzing ${jsonFiles.length} properties...\n`);

    const results = [];

    for (const file of jsonFiles) {
      const filePath = path.join(RESULTS_DIR, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      // Extract all measurement IDs and GTM IDs found
      const measurementIds = data.measurementId?.allFound || [];
      const gtmIds = data.gtmId?.allFound || [];
      const pageViewCount = data.pageViewEvent?.count || 0;
      const pageViewDetected = data.pageViewEvent?.isValid || false;

      results.push({
        propertyName: data.propertyName,
        slug: data.slug,
        url: data.url,
        expected: {
          measurementId: data.measurementId?.expected,
          gtmId: data.gtmId?.expected
        },
        actual: {
          measurementIds: measurementIds,
          gtmIds: gtmIds
        },
        pageView: {
          detected: pageViewDetected,
          count: pageViewCount,
          detectionTimeMs: data.pageViewEvent?.detectionTimeMs
        },
        isValid: data.isValid,
        issues: data.issues || []
      });
    }

    // Categorize results
    const categories = {
      multipleGA4: [],
      multipleGTM: [],
      noPageView: [],
      failed: [],
      success: []
    };

    for (const result of results) {
      if (!result.isValid) {
        categories.failed.push(result);
      } else {
        categories.success.push(result);
      }

      if (result.actual.measurementIds.length > 1) {
        categories.multipleGA4.push(result);
      }

      if (result.actual.gtmIds.length > 1) {
        categories.multipleGTM.push(result);
      }

      if (!result.pageView.detected) {
        categories.noPageView.push(result);
      }
    }

    // Generate report
    console.log('='.repeat(80));
    console.log('📊 ALL PROPERTIES ANALYSIS');
    console.log('='.repeat(80));
    console.log(`\nTotal Properties: ${results.length}`);
    console.log(`✅ Valid: ${categories.success.length}`);
    console.log(`❌ Failed: ${categories.failed.length}`);
    console.log(`\n🔍 Special Cases:`);
    console.log(`  - Multiple GA4 Properties: ${categories.multipleGA4.length}`);
    console.log(`  - Multiple GTM Containers: ${categories.multipleGTM.length}`);
    console.log(`  - No page_view Event: ${categories.noPageView.length}`);

    // Multiple GA4 Properties
    if (categories.multipleGA4.length > 0) {
      console.log('\n' + '='.repeat(80));
      console.log('🎯 SITES WITH MULTIPLE GA4 PROPERTIES');
      console.log('='.repeat(80));

      for (const prop of categories.multipleGA4) {
        console.log(`\n📍 ${prop.propertyName}`);
        console.log(`   URL: ${prop.url}`);
        console.log(`   Expected: ${prop.expected.measurementId}`);
        console.log(`   Found ${prop.actual.measurementIds.length} GA4 Properties:`);
        prop.actual.measurementIds.forEach((id, i) => {
          const match = id === prop.expected.measurementId ? '✅ MATCH' : '❌ WRONG';
          console.log(`     ${i + 1}. ${id} ${match}`);
        });
        console.log(`   page_view: ${prop.pageView.detected ? '✅ Yes' : '❌ No'} (${prop.pageView.count} events)`);
      }
    }

    // Multiple GTM Containers
    if (categories.multipleGTM.length > 0) {
      console.log('\n' + '='.repeat(80));
      console.log('📦 SITES WITH MULTIPLE GTM CONTAINERS');
      console.log('='.repeat(80));

      for (const prop of categories.multipleGTM) {
        console.log(`\n📍 ${prop.propertyName}`);
        console.log(`   URL: ${prop.url}`);
        console.log(`   Expected: ${prop.expected.gtmId}`);
        console.log(`   Found ${prop.actual.gtmIds.length} GTM Containers:`);
        prop.actual.gtmIds.forEach((id, i) => {
          const match = id === prop.expected.gtmId ? '✅ MATCH' : '❌ WRONG';
          console.log(`     ${i + 1}. ${id} ${match}`);
        });
      }
    }

    // No page_view events
    if (categories.noPageView.length > 0) {
      console.log('\n' + '='.repeat(80));
      console.log('⚠️  SITES WITHOUT page_view EVENT');
      console.log('='.repeat(80));

      for (const prop of categories.noPageView) {
        console.log(`\n📍 ${prop.propertyName}`);
        console.log(`   URL: ${prop.url}`);
        console.log(`   GA4: ${prop.actual.measurementIds.join(', ') || 'None'}`);
        console.log(`   GTM: ${prop.actual.gtmIds.join(', ') || 'None'}`);
      }
    }

    // Failed properties summary
    console.log('\n' + '='.repeat(80));
    console.log('❌ FAILED PROPERTIES SUMMARY');
    console.log('='.repeat(80));

    const issueTypes = {};
    for (const prop of categories.failed) {
      for (const issue of prop.issues) {
        issueTypes[issue.type] = (issueTypes[issue.type] || 0) + 1;
      }
    }

    console.log('\nIssue Types:');
    Object.entries(issueTypes).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });

    // Save detailed report
    const reportPath = path.join(RESULTS_DIR, 'ALL_PROPERTIES_ANALYSIS.json');
    await fs.writeFile(
      reportPath,
      JSON.stringify({
        timestamp: new Date().toISOString(),
        summary: {
          total: results.length,
          valid: categories.success.length,
          failed: categories.failed.length,
          multipleGA4: categories.multipleGA4.length,
          multipleGTM: categories.multipleGTM.length,
          noPageView: categories.noPageView.length
        },
        categories,
        issueTypes
      }, null, 2)
    );

    console.log(`\n📄 Detailed report saved: ${reportPath}\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

analyzeAllProperties();
