import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const runId = process.argv[2] || '54bc59d6-acb4-4cc6-b070-9d1f4b8e15c2';

async function analyzeRunDuplicates() {
  console.log('\n=== Analyzing Run:', runId, '===\n');

  // 1. Get all results
  const { data: results, error } = await supabase
    .from('crawl_results')
    .select('property_id, validation_status, issue_summary, issue_types, has_issues, created_at, properties(property_name, url)')
    .eq('crawl_run_id', runId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Total results:', results.length);

  // Count unique properties
  const uniqueProperties = new Set(results.map(r => r.property_id));
  console.log('Unique properties:', uniqueProperties.size);
  console.log('Expected max: 85');

  if (results.length !== uniqueProperties.size) {
    console.log('\n❌ PROBLEM: Duplicate results detected!');
    console.log(`   Extra results: ${results.length - uniqueProperties.size}`);
  }

  // Find duplicates
  const propertyCounts = {};
  results.forEach(r => {
    propertyCounts[r.property_id] = (propertyCounts[r.property_id] || 0) + 1;
  });

  const duplicates = Object.entries(propertyCounts).filter(([id, count]) => count > 1);
  console.log('\n=== Duplicate Properties Analysis ===');
  console.log('Duplicate properties:', duplicates.length);

  if (duplicates.length > 0) {
    console.log('\nDuplicate Details:');
    duplicates.slice(0, 10).forEach(([propId, count]) => {
      const dupeResults = results.filter(r => r.property_id === propId);
      console.log(`\n  Property: ${dupeResults[0].properties?.property_name || propId}`);
      console.log(`  Count: ${count} times`);
      console.log(`  URL: ${dupeResults[0].properties?.url || 'NULL'}`);
      dupeResults.forEach((r, idx) => {
        console.log(`    ${idx + 1}. Status: ${r.validation_status || 'NULL'}, Created: ${r.created_at}`);
        if (r.issue_summary) {
          console.log(`       Issues: ${r.issue_summary.substring(0, 100)}`);
        }
      });
    });
  }

  // Analyze validation status
  console.log('\n\n=== Validation Status Summary ===');
  const statusCounts = {
    passed: results.filter(r => r.validation_status === 'passed').length,
    failed: results.filter(r => r.validation_status === 'failed').length,
    error: results.filter(r => r.validation_status === 'error').length
  };
  console.log('Passed:', statusCounts.passed);
  console.log('Failed:', statusCounts.failed);
  console.log('Error:', statusCounts.error);

  // Analyze failures
  const failures = results.filter(r =>
    r.validation_status === 'failed' ||
    r.validation_status === 'error' ||
    r.has_issues
  );
  console.log('\n\n=== Failure Analysis ===');
  console.log('Total with issues/errors:', failures.length);

  if (failures.length > 0) {
    // Group by issue types
    const issueGroups = {};
    failures.forEach(f => {
      const issueKey = f.issue_types?.join(', ') || f.issue_summary || 'Unknown error';
      if (!issueGroups[issueKey]) {
        issueGroups[issueKey] = [];
      }
      issueGroups[issueKey].push(f);
    });

    console.log('\nIssue Types:');
    Object.entries(issueGroups).forEach(([issues, items]) => {
      console.log(`\n  ${items.length}x: ${issues.substring(0, 150)}`);

      // Show first example
      const example = items[0];
      console.log(`     Example: ${example.properties?.property_name || 'N/A'}`);
      console.log(`     URL: ${example.properties?.url || 'NULL'}`);
      console.log(`     Status: ${example.validation_status}`);
      if (example.issue_summary) {
        console.log(`     Summary: ${example.issue_summary.substring(0, 100)}`);
      }
    });
  }

  // Check for missing URLs in properties table
  const missingUrls = results.filter(r => !r.properties?.url);
  console.log('\n\n=== Missing URL Analysis ===');
  console.log('Results with missing URL in properties:', missingUrls.length);

  if (missingUrls.length > 0) {
    console.log('\n❌ PROBLEM: Some properties have no URL!');
    console.log('\nSample properties without URL:');
    missingUrls.slice(0, 5).forEach((r, idx) => {
      console.log(`  ${idx + 1}. ${r.properties?.property_name || r.property_id}`);
      console.log(`     Status: ${r.validation_status}`);
      console.log(`     Has issues: ${r.has_issues}`);
    });
  }
}

analyzeRunDuplicates();
