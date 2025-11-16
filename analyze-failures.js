/**
 * Analyze failure reasons from validation results
 */

import fs from 'fs';
import path from 'path';

const RESULTS_DIR = './results/2025-10-30';

const failures = {
  pageViewTimeout: [],
  pageViewNotFound: [],
  measurementIdMismatch: [],
  gtmIdMismatch: [],
  other: []
};

// Read all result files
const files = fs.readdirSync(RESULTS_DIR)
  .filter(f => f.endsWith('.json') && f !== '_summary.json');

console.log(`\n📊 Analyzing ${files.length} result files...\n`);

for (const file of files) {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, file), 'utf-8'));

    if (!data.isValid) {
      // Categorize failures
      const property = {
        name: data.propertyName,
        url: data.url,
        issues: data.issues
      };

      // Check page_view issues
      if (data.pageViewEvent && !data.pageViewEvent.isValid) {
        if (data.pageViewEvent.timedOut) {
          failures.pageViewTimeout.push(property);
        } else {
          failures.pageViewNotFound.push(property);
        }
      }

      // Check measurement ID issues
      if (data.measurementId && !data.measurementId.isValid) {
        failures.measurementIdMismatch.push(property);
      }

      // Check GTM ID issues
      if (data.gtmId && !data.gtmId.isValid) {
        failures.gtmIdMismatch.push(property);
      }

      // If no specific category, mark as other
      if (data.pageViewEvent?.isValid && data.measurementId?.isValid && data.gtmId?.isValid) {
        failures.other.push(property);
      }
    }
  } catch (error) {
    console.error(`Error reading ${file}:`, error.message);
  }
}

// Calculate totals
const totalFailures = files.filter(f => {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, f), 'utf-8'));
    return !data.isValid;
  } catch {
    return false;
  }
}).length;

const totalSuccess = files.length - totalFailures;

console.log('🔍 Failure Analysis:\n');
console.log(`Total Properties: ${files.length}`);
console.log(`✅ Success: ${totalSuccess} (${(totalSuccess/files.length*100).toFixed(1)}%)`);
console.log(`❌ Failed: ${totalFailures} (${(totalFailures/files.length*100).toFixed(1)}%)`);

console.log('\n📋 Failure Breakdown:\n');
console.log(`⏱️  Page View Timeout (30s exceeded): ${failures.pageViewTimeout.length}`);
console.log(`❌ Page View Not Found: ${failures.pageViewNotFound.length}`);
console.log(`🔢 Measurement ID Mismatch: ${failures.measurementIdMismatch.length}`);
console.log(`🏷️  GTM ID Mismatch: ${failures.gtmIdMismatch.length}`);
console.log(`❓ Other Issues: ${failures.other.length}`);

// Show timeout cases
if (failures.pageViewTimeout.length > 0) {
  console.log('\n⏱️  Properties that timed out (>30s):');
  failures.pageViewTimeout.forEach(p => {
    console.log(`   - ${p.name}`);
    console.log(`     URL: ${p.url}`);
  });
}

// Show page_view not found cases
if (failures.pageViewNotFound.length > 0) {
  console.log('\n❌ Properties with no page_view event detected:');
  failures.pageViewNotFound.slice(0, 10).forEach(p => {
    console.log(`   - ${p.name}`);
    console.log(`     URL: ${p.url}`);
  });
  if (failures.pageViewNotFound.length > 10) {
    console.log(`   ... and ${failures.pageViewNotFound.length - 10} more`);
  }
}

// Show measurement ID mismatches
if (failures.measurementIdMismatch.length > 0) {
  console.log('\n🔢 Measurement ID Mismatches:');
  failures.measurementIdMismatch.slice(0, 5).forEach(p => {
    console.log(`   - ${p.name}`);
    const issue = p.issues.find(i => i.type === 'MEASUREMENT_ID_MISMATCH' || i.type === 'NO_GA4_EVENTS');
    if (issue) {
      console.log(`     Expected: ${issue.expected}`);
      console.log(`     Actual: ${issue.actual || 'none'}`);
    }
  });
  if (failures.measurementIdMismatch.length > 5) {
    console.log(`   ... and ${failures.measurementIdMismatch.length - 5} more`);
  }
}

console.log('\n');
