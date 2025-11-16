/**
 * Check if validation logic correctly handles multiple GA4/GTM properties
 */

import fs from 'fs/promises';
import path from 'path';

const RESULTS_DIR = './results/2025-10-30';

async function checkValidationLogic() {
  try {
    // Read all validation results
    const files = await fs.readdir(RESULTS_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json') && !f.startsWith('_'));

    console.log('\n' + '='.repeat(80));
    console.log('🔍 VALIDATION LOGIC CHECK: allFound vs expected');
    console.log('='.repeat(80));

    let correctLogic = 0;
    let incorrectLogic = 0;
    const issues = [];

    for (const file of jsonFiles) {
      const filePath = path.join(RESULTS_DIR, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      // Check Measurement ID logic
      if (data.measurementId) {
        const expected = data.measurementId.expected;
        const allFound = data.measurementId.allFound || [];
        const isValid = data.measurementId.isValid;

        // Correct logic: isValid should be true if expected exists in allFound
        const shouldBeValid = allFound.includes(expected);

        if (shouldBeValid !== isValid) {
          incorrectLogic++;
          issues.push({
            property: data.propertyName,
            type: 'MEASUREMENT_ID',
            expected,
            allFound,
            isValid,
            shouldBeValid,
            problem: shouldBeValid ? 'FALSE NEGATIVE' : 'FALSE POSITIVE'
          });
        } else {
          correctLogic++;
        }
      }

      // Check GTM ID logic
      if (data.gtmId) {
        const expected = data.gtmId.expected;
        const allFound = data.gtmId.allFound || [];
        const isValid = data.gtmId.isValid;

        const shouldBeValid = allFound.includes(expected);

        if (shouldBeValid !== isValid) {
          incorrectLogic++;
          issues.push({
            property: data.propertyName,
            type: 'GTM_ID',
            expected,
            allFound,
            isValid,
            shouldBeValid,
            problem: shouldBeValid ? 'FALSE NEGATIVE' : 'FALSE POSITIVE'
          });
        } else {
          correctLogic++;
        }
      }
    }

    console.log(`\n✅ Correct validations: ${correctLogic}`);
    console.log(`❌ Incorrect validations: ${incorrectLogic}`);

    if (issues.length > 0) {
      console.log('\n' + '='.repeat(80));
      console.log('❌ VALIDATION LOGIC ISSUES FOUND');
      console.log('='.repeat(80));

      for (const issue of issues) {
        console.log(`\n📍 ${issue.property} - ${issue.type}`);
        console.log(`   Expected: ${issue.expected}`);
        console.log(`   All Found: [${issue.allFound.join(', ')}]`);
        console.log(`   Current isValid: ${issue.isValid}`);
        console.log(`   Should be Valid: ${issue.shouldBeValid}`);
        console.log(`   ⚠️  ${issue.problem}: Expected ${issue.shouldBeValid ? 'FOUND' : 'NOT FOUND'} in array but marked as ${issue.isValid ? 'valid' : 'invalid'}`);
      }
    } else {
      console.log('\n✅ All validation logic is CORRECT!');
      console.log('   Expected values are properly checked against allFound arrays.');
    }

    // Now check the actual failed properties
    console.log('\n' + '='.repeat(80));
    console.log('📊 REAL FAILURES: Expected NOT in allFound');
    console.log('='.repeat(80));

    const realFailures = [];

    for (const file of jsonFiles) {
      const filePath = path.join(RESULTS_DIR, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      const failures = [];

      // Check Measurement ID
      if (data.measurementId && !data.measurementId.isValid) {
        const expected = data.measurementId.expected;
        const allFound = data.measurementId.allFound || [];

        if (!allFound.includes(expected)) {
          failures.push({
            type: 'Measurement ID',
            expected,
            allFound
          });
        }
      }

      // Check GTM ID
      if (data.gtmId && !data.gtmId.isValid) {
        const expected = data.gtmId.expected;
        const allFound = data.gtmId.allFound || [];

        if (!allFound.includes(expected)) {
          failures.push({
            type: 'GTM ID',
            expected,
            allFound
          });
        }
      }

      if (failures.length > 0) {
        realFailures.push({
          property: data.propertyName,
          url: data.url,
          failures
        });
      }
    }

    console.log(`\nTotal Real Failures: ${realFailures.length}`);

    for (const failure of realFailures) {
      console.log(`\n❌ ${failure.property}`);
      console.log(`   URL: ${failure.url}`);

      for (const f of failure.failures) {
        console.log(`\n   ${f.type}:`);
        console.log(`     Expected: ${f.expected}`);
        console.log(`     Found: [${f.allFound.join(', ') || 'NONE'}]`);
        console.log(`     ⚠️  CSV 기대값이 사이트에 존재하지 않음`);
      }
    }

    console.log('\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkValidationLogic();
