/**
 * Comprehensive Failure Analysis
 *
 * Categorizes all validation failures into specific types:
 * - Service terminated/closed
 * - HTTP errors (404, 500, etc.)
 * - Redirects
 * - Real timeouts (slow loading)
 * - Measurement ID mismatches
 * - GTM ID mismatches
 * - No GA4 events
 */

import fs from 'fs';
import path from 'path';

const RESULTS_DIR = './results/2025-10-30';
const SCREENSHOTS_DIR = './screenshots/2025-10-30';

const categories = {
  serviceTerminated: [],
  httpError: [],
  redirect: [],
  realTimeout: [],
  noGA4Events: [],
  measurementIdMismatch: [],
  gtmIdMismatch: [],
  multipleIssues: [],
  success: []
};

// Keywords indicating service termination
const terminationKeywords = [
  '종료',
  'terminated',
  'closed',
  '서비스가 종료',
  'service ended',
  'no longer available'
];

console.log('\n📊 Comprehensive Failure Analysis\n');
console.log('Analyzing validation results...\n');

// Read all result files
const files = fs.readdirSync(RESULTS_DIR)
  .filter(f => f.endsWith('.json') && f !== '_summary.json');

for (const file of files) {
  try {
    const filePath = path.join(RESULTS_DIR, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    const property = {
      name: data.propertyName,
      slug: data.slug,
      url: data.url,
      isValid: data.isValid,
      issues: data.issues || [],
      pageLoad: data.pageLoad || {},
      pageViewEvent: data.pageViewEvent || {},
      measurementId: data.measurementId || {},
      gtmId: data.gtmId || {},
      screenshotPath: data.screenshotPath
    };

    // Success
    if (data.isValid) {
      categories.success.push(property);
      continue;
    }

    // Analyze failure type
    const issueTypes = [];

    // Check HTTP status
    if (property.pageLoad.statusCode) {
      if (property.pageLoad.statusCode >= 400) {
        issueTypes.push('HTTP_ERROR');
        property.httpStatus = property.pageLoad.statusCode;
      }
    }

    // Check redirect
    if (property.pageLoad.redirected) {
      issueTypes.push('REDIRECT');
      property.finalUrl = property.pageLoad.finalUrl;
    }

    // Check screenshot size (service terminated pages are usually small)
    if (property.screenshotPath) {
      const screenshotFullPath = path.join(process.cwd(), property.screenshotPath);
      if (fs.existsSync(screenshotFullPath)) {
        const stats = fs.statSync(screenshotFullPath);
        property.screenshotSize = stats.size;

        // Small screenshots (<300KB) might indicate termination page
        if (stats.size < 300000) {
          property.suspiciouslySmall = true;
        }
      }
    }

    // Check page_view timeout
    if (property.pageViewEvent.timedOut) {
      issueTypes.push('TIMEOUT');
      property.timeoutDuration = '60s';
    }

    // Check no GA4 events
    if (property.issues.some(i => i.type === 'NO_GA4_EVENTS')) {
      issueTypes.push('NO_GA4_EVENTS');
    }

    // Check measurement ID mismatch
    if (!property.measurementId.isValid && property.measurementId.actual) {
      issueTypes.push('MEASUREMENT_ID_MISMATCH');
      property.expectedMeasurementId = property.measurementId.expected;
      property.actualMeasurementId = property.measurementId.actual;
    }

    // Check GTM ID mismatch
    if (!property.gtmId.isValid && property.gtmId.actual) {
      issueTypes.push('GTM_ID_MISMATCH');
      property.expectedGTMId = property.gtmId.expected;
      property.actualGTMId = property.gtmId.actual;
    }

    // Categorize based on primary issue
    if (issueTypes.includes('HTTP_ERROR')) {
      categories.httpError.push(property);
    } else if (property.suspiciouslySmall && issueTypes.includes('NO_GA4_EVENTS')) {
      // Small screenshot + no events = likely service terminated
      categories.serviceTerminated.push(property);
    } else if (issueTypes.includes('REDIRECT')) {
      categories.redirect.push(property);
    } else if (issueTypes.includes('TIMEOUT')) {
      categories.realTimeout.push(property);
    } else if (issueTypes.includes('NO_GA4_EVENTS')) {
      categories.noGA4Events.push(property);
    } else if (issueTypes.includes('MEASUREMENT_ID_MISMATCH')) {
      categories.measurementIdMismatch.push(property);
    } else if (issueTypes.includes('GTM_ID_MISMATCH')) {
      categories.gtmIdMismatch.push(property);
    } else if (issueTypes.length > 1) {
      categories.multipleIssues.push(property);
    }

  } catch (error) {
    console.error(`Error reading ${file}:`, error.message);
  }
}

// Calculate totals
const totalProperties = files.length;
const totalFailures = totalProperties - categories.success.length;

console.log('═══════════════════════════════════════════════════════════\n');
console.log(`📈 OVERALL STATISTICS\n`);
console.log(`Total Properties: ${totalProperties}`);
console.log(`✅ Success: ${categories.success.length} (${(categories.success.length/totalProperties*100).toFixed(1)}%)`);
console.log(`❌ Failed: ${totalFailures} (${(totalFailures/totalProperties*100).toFixed(1)}%)`);

console.log('\n═══════════════════════════════════════════════════════════\n');
console.log('📋 FAILURE BREAKDOWN BY CATEGORY\n');

// Service Terminated
if (categories.serviceTerminated.length > 0) {
  console.log(`\n🚫 Service Terminated/Closed: ${categories.serviceTerminated.length}`);
  console.log('   Sites that are no longer active or have been shut down');
  categories.serviceTerminated.forEach(p => {
    console.log(`   - ${p.name}`);
    console.log(`     URL: ${p.url}`);
    console.log(`     Screenshot: ${p.screenshotSize ? Math.round(p.screenshotSize/1024) + 'KB' : 'N/A'}`);
  });
}

// HTTP Errors
if (categories.httpError.length > 0) {
  console.log(`\n⚠️  HTTP Errors: ${categories.httpError.length}`);
  console.log('   Sites returning error status codes');
  categories.httpError.forEach(p => {
    console.log(`   - ${p.name}`);
    console.log(`     URL: ${p.url}`);
    console.log(`     HTTP ${p.httpStatus}`);
  });
}

// Redirects
if (categories.redirect.length > 0) {
  console.log(`\n🔀 Redirects: ${categories.redirect.length}`);
  console.log('   Sites that redirect to different URLs');
  categories.redirect.forEach(p => {
    console.log(`   - ${p.name}`);
    console.log(`     From: ${p.url}`);
    console.log(`     To: ${p.finalUrl}`);
  });
}

// Real Timeouts
if (categories.realTimeout.length > 0) {
  console.log(`\n⏱️  Real Timeouts (>60s): ${categories.realTimeout.length}`);
  console.log('   Working sites that are extremely slow to load page_view events');
  categories.realTimeout.forEach(p => {
    console.log(`   - ${p.name}`);
    console.log(`     URL: ${p.url}`);
    console.log(`     Timeout: ${p.timeoutDuration}`);
  });
}

// No GA4 Events
if (categories.noGA4Events.length > 0) {
  console.log(`\n📡 No GA4 Events: ${categories.noGA4Events.length}`);
  console.log('   Sites loaded but no GA4 tracking detected');
  categories.noGA4Events.forEach(p => {
    console.log(`   - ${p.name}`);
    console.log(`     URL: ${p.url}`);
  });
}

// Measurement ID Mismatch
if (categories.measurementIdMismatch.length > 0) {
  console.log(`\n🔢 Measurement ID Mismatch: ${categories.measurementIdMismatch.length}`);
  console.log('   Sites with GA4 but wrong Measurement ID');
  categories.measurementIdMismatch.slice(0, 10).forEach(p => {
    console.log(`   - ${p.name}`);
    console.log(`     Expected: ${p.expectedMeasurementId}`);
    console.log(`     Actual: ${p.actualMeasurementId}`);
  });
  if (categories.measurementIdMismatch.length > 10) {
    console.log(`   ... and ${categories.measurementIdMismatch.length - 10} more`);
  }
}

// GTM ID Mismatch
if (categories.gtmIdMismatch.length > 0) {
  console.log(`\n🏷️  GTM ID Mismatch: ${categories.gtmIdMismatch.length}`);
  console.log('   Sites with GTM but wrong Container ID');
  categories.gtmIdMismatch.forEach(p => {
    console.log(`   - ${p.name}`);
    console.log(`     Expected: ${p.expectedGTMId}`);
    console.log(`     Actual: ${p.actualGTMId}`);
  });
}

// Multiple Issues
if (categories.multipleIssues.length > 0) {
  console.log(`\n🔴 Multiple Issues: ${categories.multipleIssues.length}`);
  console.log('   Sites with multiple validation problems');
  categories.multipleIssues.forEach(p => {
    console.log(`   - ${p.name}`);
    console.log(`     Issues: ${p.issues.map(i => i.type).join(', ')}`);
  });
}

console.log('\n═══════════════════════════════════════════════════════════\n');
console.log('💡 RECOMMENDATIONS\n');

if (categories.serviceTerminated.length > 0) {
  console.log(`⚠️  Remove ${categories.serviceTerminated.length} terminated service(s) from CSV`);
}

if (categories.httpError.length > 0) {
  console.log(`⚠️  Investigate ${categories.httpError.length} HTTP error(s)`);
}

if (categories.measurementIdMismatch.length > 0) {
  console.log(`⚠️  Update ${categories.measurementIdMismatch.length} Measurement ID(s) in CSV`);
}

if (categories.realTimeout.length > 0) {
  console.log(`⚠️  Consider increasing timeout beyond 60s for ${categories.realTimeout.length} slow site(s)`);
}

console.log('\n');

// Export detailed report
const report = {
  timestamp: new Date().toISOString(),
  summary: {
    total: totalProperties,
    success: categories.success.length,
    failed: totalFailures,
    successRate: `${(categories.success.length/totalProperties*100).toFixed(1)}%`
  },
  categories: {
    serviceTerminated: categories.serviceTerminated.length,
    httpError: categories.httpError.length,
    redirect: categories.redirect.length,
    realTimeout: categories.realTimeout.length,
    noGA4Events: categories.noGA4Events.length,
    measurementIdMismatch: categories.measurementIdMismatch.length,
    gtmIdMismatch: categories.gtmIdMismatch.length,
    multipleIssues: categories.multipleIssues.length
  },
  details: categories
};

fs.writeFileSync(
  path.join(RESULTS_DIR, '_comprehensive_analysis.json'),
  JSON.stringify(report, null, 2)
);

console.log(`📄 Detailed report saved to: ${RESULTS_DIR}/_comprehensive_analysis.json\n`);
