#!/usr/bin/env node
import supabase from './src/utils/supabase.js';

const runId = '30b02e1b-dfc9-44dd-a448-3f089199a069';

console.log('\n' + '='.repeat(80));
console.log('🔍 Innisfree Issue Investigation');
console.log('='.repeat(80));
console.log(`Run ID: ${runId}\n`);

// First, get property_id for innisfree
const { data: properties, error: propError } = await supabase
  .from('properties')
  .select('id, property_name, slug, url')
  .ilike('url', '%innisfree%');

if (propError) {
  console.error('❌ Error getting properties:', propError.message);
  process.exit(1);
}

if (!properties || properties.length === 0) {
  console.log('⚠️  No properties found for innisfree.com');
  process.exit(0);
}

console.log(`Found ${properties.length} property(ies):`);
properties.forEach(p => {
  console.log(`  - ${p.property_name} (${p.url})`);
});

const propertyIds = properties.map(p => p.id);

// Get results for these properties
const { data: results, error: resultsError } = await supabase
  .from('crawl_results')
  .select('*')
  .eq('crawl_run_id', runId)
  .in('property_id', propertyIds)
  .order('created_at');

if (resultsError) {
  console.error('❌ Error getting results:', resultsError.message);
  process.exit(1);
}

if (!results || results.length === 0) {
  console.log('\n⚠️  No crawl results found for innisfree.com in this run');
  process.exit(0);
}

console.log(`\nFound ${results.length} result(s):\n`);

results.forEach((result, idx) => {
  const prop = properties.find(p => p.id === result.property_id);
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Result ${idx + 1}/${results.length}`);
  console.log('='.repeat(80));
  console.log(`Property Name: ${result.property_name || prop.property_name}`);
  console.log(`URL: ${prop.url}`);
  console.log(`Phase: ${result.phase || 'unknown'}`);
  console.log(`Validation Status: ${result.validation_status}`);
  console.log(`Has Issues: ${result.has_issues}`);
  console.log(`Execution Time: ${result.execution_time_ms}ms (${(result.execution_time_ms / 1000).toFixed(1)}s)`);
  console.log(`Created At: ${result.created_at}`);
  
  if (result.issue_summary) {
    console.log(`\nIssue Summary:`);
    console.log(`  ${result.issue_summary}`);
  }
  
  if (result.issues && result.issues.length > 0) {
    console.log(`\nDetailed Issues:`);
    result.issues.forEach((issue, i) => {
      console.log(`  ${i + 1}. [${issue.severity}] ${issue.type}`);
      console.log(`     ${issue.message}`);
    });
  }
  
  if (result.page_load) {
    console.log(`\nPage Load Info:`);
    console.log(`  Status Code: ${result.page_load.statusCode || 'N/A'}`);
    console.log(`  Final URL: ${result.page_load.finalUrl}`);
    console.log(`  Redirected: ${result.page_load.redirected}`);
  }
});

console.log('\n' + '='.repeat(80));
console.log('📊 Analysis');
console.log('='.repeat(80));

const phase1Results = results.filter(r => r.phase === 1);
const phase2Results = results.filter(r => r.phase === 2);

console.log(`Phase 1 results: ${phase1Results.length}`);
console.log(`Phase 2 results: ${phase2Results.length}`);

if (phase2Results.length > 0) {
  const phase2 = phase2Results[0];
  console.log(`\n⚠️  This property reached Phase 2 (80s timeout)`);
  console.log(`Execution time: ${phase2.execution_time_ms}ms (${(phase2.execution_time_ms / 1000).toFixed(1)}s)`);
  
  if (phase2.execution_time_ms > 80000) {
    console.log(`\n🚨 ISSUE CONFIRMED: Exceeded 80s timeout by ${((phase2.execution_time_ms - 80000) / 1000).toFixed(1)}s!`);
  } else if (phase2.validation_status === 'timeout') {
    console.log(`\n✅ Timeout was properly detected within 80s limit`);
  }
}

console.log('\n' + '='.repeat(80) + '\n');
