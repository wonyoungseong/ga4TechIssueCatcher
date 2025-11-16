#!/usr/bin/env node
/**
 * Diagnose why Phase 2 didn't execute for Run ID 31ebd71c-06ff-4d9c-94c6-03b76869a940
 */

import supabase from './src/utils/supabase.js';

const runId = '31ebd71c-06ff-4d9c-94c6-03b76869a940';

console.log('\n' + '='.repeat(80));
console.log('🔍 Phase 2 Issue Diagnosis');
console.log('='.repeat(80));
console.log(`Run ID: ${runId}\n`);

// Get all results
const { data: results, error: resultsError} = await supabase
  .from('crawl_results')
  .select('property_id, phase, validation_status, issue_summary, issue_types')
  .eq('crawl_run_id', runId)
  .order('created_at');

if (resultsError) {
  console.error('❌ Error:', resultsError.message);
  process.exit(1);
}

console.log(`Total Results: ${results.length}`);

// Group by phase
const byPhase = {};
results.forEach(r => {
  const phase = r.phase || 'unknown';
  byPhase[phase] = (byPhase[phase] || 0) + 1;
});

console.log('\n📊 Phase Breakdown:');
Object.entries(byPhase).forEach(([phase, count]) => {
  console.log(`   Phase ${phase}: ${count} properties`);
});

// Find all failures (validation_status !== 'passed')
const failures = results.filter(r => r.validation_status !== 'passed');
console.log(`\n❌ Total Failures: ${failures.length}`);

// Count failures by issue type
const issueTypeCounts = {};
failures.forEach(r => {
  if (r.issue_types && Array.isArray(r.issue_types)) {
    r.issue_types.forEach(type => {
      issueTypeCounts[type] = (issueTypeCounts[type] || 0) + 1;
    });
  }
});

// Look for timeout-related failures by checking issue_summary
const timeoutFailures = failures.filter(r =>
  r.issue_summary && r.issue_summary.toLowerCase().includes('timeout')
);
console.log(`⏱️  Timeout-Related Failures: ${timeoutFailures.length}`);

if (timeoutFailures.length > 0) {
  console.log('\n' + '='.repeat(80));
  console.log('Timeout Failure Examples:');
  console.log('='.repeat(80));

  // Show first 5 timeout failures
  timeoutFailures.slice(0, 5).forEach((result, idx) => {
    console.log(`\n${idx + 1}. Property ID: ${result.property_id}`);
    console.log(`   Phase: ${result.phase || 'unknown'}`);
    console.log(`   Status: ${result.validation_status}`);
    console.log(`   Summary: ${result.issue_summary}`);
    console.log(`   Types: ${result.issue_types ? result.issue_types.join(', ') : 'None'}`);
  });
}

// Check issue types
if (Object.keys(issueTypeCounts).length > 0) {
  console.log('\n📊 Issue Type Breakdown:');
  Object.entries(issueTypeCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      console.log(`   ${type}: ${count}`);
    });
}

// Summary
console.log('\n' + '='.repeat(80));
console.log('📋 Analysis Summary');
console.log('='.repeat(80));
console.log(`✅ Total Results: ${results.length}`);
console.log(`📍 Phase 1: ${byPhase[1] || 0}`);
console.log(`📍 Phase 2: ${byPhase[2] || 0}`);
console.log(`❌ Total Failures: ${failures.length}`);
console.log(`⏱️  Timeout-Related Failures (should queue for Phase 2): ${timeoutFailures.length}`);
console.log(`⚠️  Non-Timeout Failures: ${failures.length - timeoutFailures.length}`);

if (timeoutFailures.length > 0 && (byPhase[2] || 0) === 0) {
  console.log('\n🚨 ISSUE DETECTED:');
  console.log(`   ${timeoutFailures.length} timeout-related failures occurred in Phase 1`);
  console.log(`   BUT Phase 2 shows ${byPhase[2] || 0} results`);
  console.log('   → Timeout failures were NOT queued for Phase 2! ❌');
}

console.log('\n' + '='.repeat(80) + '\n');
