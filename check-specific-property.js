#!/usr/bin/env node
/**
 * Check specific property failure reason
 */

import supabase from './src/utils/supabase.js';

const runId = '31ebd71c-06ff-4d9c-94c6-03b76869a940';
const targetUrl = 'https://vn.sulwhasoo.com/';

console.log('\n' + '='.repeat(80));
console.log(`🔍 Checking failure for: ${targetUrl}`);
console.log(`   Run ID: ${runId}`);
console.log('='.repeat(80));

async function checkProperty() {
  // Get property info from properties table
  const { data: properties, error: propError } = await supabase
    .from('properties')
    .select('*')
    .eq('url', targetUrl);

  if (propError) {
    console.error('\n❌ Error fetching property:', propError.message);
    return;
  }

  if (!properties || properties.length === 0) {
    console.log('\n❌ Property not found in database');
    return;
  }

  if (properties.length > 1) {
    console.log(`\n⚠️  Found ${properties.length} properties with this URL:`);
    properties.forEach((prop, idx) => {
      console.log(`   ${idx + 1}. ${prop.property_name} (${prop.account_name})`);
    });
    console.log('\n   Checking all properties...\n');
  }

  // Check all properties
  for (const property of properties) {

  console.log('\n📋 Property Information:');
  console.log(`   Property Name: ${property.property_name}`);
  console.log(`   Account: ${property.account_name}`);
  console.log(`   Measurement ID: ${property.measurement_id}`);
  console.log(`   GTM ID: ${property.web_gtm_id || 'N/A'}`);

  // Get crawl result for this property and run
  const { data: result, error: resultError } = await supabase
    .from('crawl_results')
    .select('*')
    .eq('crawl_run_id', runId)
    .eq('property_id', property.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (resultError) {
    console.error('\n❌ Error fetching crawl result:', resultError.message);
    return;
  }

  if (!result) {
    console.log('\n❌ No crawl result found for this property in the specified run');
    return;
  }

  console.log('\n' + '='.repeat(80));
  console.log('📊 Crawl Result:');
  console.log('='.repeat(80));
  console.log(`   Validation Status: ${result.validation_status}`);
  console.log(`   Phase: ${result.phase || 'N/A'}`);
  console.log(`   Has Issues: ${result.has_issues}`);
  console.log(`   Created At: ${result.created_at}`);

  if (result.issue_types && result.issue_types.length > 0) {
    console.log('\n❌ Issue Types:');
    result.issue_types.forEach(type => {
      console.log(`   • ${type}`);
    });
  }

  if (result.issue_summary) {
    console.log('\n📝 Issue Summary:');
    console.log(`   ${result.issue_summary}`);
  }

  if (result.validation_result) {
    console.log('\n' + '='.repeat(80));
    console.log('🔍 Detailed Validation Result:');
    console.log('='.repeat(80));

    const validation = result.validation_result;

    // Measurement ID validation
    if (validation.measurementId) {
      console.log('\n📍 Measurement ID Validation:');
      console.log(`   Expected: ${validation.measurementId.expected}`);
      console.log(`   Actual: ${validation.measurementId.actual || 'None detected'}`);
      console.log(`   Valid: ${validation.measurementId.isValid ? '✅' : '❌'}`);

      if (validation.measurementId.allFound && validation.measurementId.allFound.length > 0) {
        console.log(`   All Found IDs: ${validation.measurementId.allFound.join(', ')}`);
      }

      if (validation.measurementId.issues && validation.measurementId.issues.length > 0) {
        console.log('   Issues:');
        validation.measurementId.issues.forEach(issue => {
          console.log(`      • ${issue.type}: ${issue.message}`);
        });
      }
    }

    // GTM ID validation
    if (validation.gtmId) {
      console.log('\n📍 GTM Container ID Validation:');
      console.log(`   Expected: ${validation.gtmId.expected || 'Not required'}`);
      console.log(`   Actual: ${validation.gtmId.actual || 'None detected'}`);
      console.log(`   Valid: ${validation.gtmId.isValid ? '✅' : '❌'}`);

      if (validation.gtmId.allFound && validation.gtmId.allFound.length > 0) {
        console.log(`   All Found IDs: ${validation.gtmId.allFound.join(', ')}`);
      }

      if (validation.gtmId.issues && validation.gtmId.issues.length > 0) {
        console.log('   Issues:');
        validation.gtmId.issues.forEach(issue => {
          console.log(`      • ${issue.type}: ${issue.message}`);
        });
      }
    }

    // Page View Event validation
    if (validation.pageViewEvent) {
      console.log('\n📍 Page View Event Validation:');
      console.log(`   Count: ${validation.pageViewEvent.count || 0}`);
      console.log(`   Valid: ${validation.pageViewEvent.isValid ? '✅' : '❌'}`);

      if (validation.pageViewEvent.detectionTimeMs) {
        console.log(`   Detection Time: ${validation.pageViewEvent.detectionTimeMs}ms`);
      }
      if (validation.pageViewEvent.timedOut !== undefined) {
        console.log(`   Timed Out: ${validation.pageViewEvent.timedOut ? 'Yes' : 'No'}`);
      }

      if (validation.pageViewEvent.issues && validation.pageViewEvent.issues.length > 0) {
        console.log('   Issues:');
        validation.pageViewEvent.issues.forEach(issue => {
          console.log(`      • ${issue.type}: ${issue.message}`);
        });
      }
    }

    // Overall validation
    console.log('\n' + '='.repeat(80));
    console.log(`Overall Valid: ${validation.isValid ? '✅' : '❌'}`);
    console.log(`Execution Time: ${validation.executionTimeMs}ms`);
  }

  if (result.error_message) {
    console.log('\n' + '='.repeat(80));
    console.log('❌ Error Message:');
    console.log('='.repeat(80));
    console.log(result.error_message);
  }

  console.log('\n' + '='.repeat(80) + '\n');
  } // end for loop
}

checkProperty().catch(console.error);
