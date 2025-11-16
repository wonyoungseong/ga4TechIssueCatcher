/**
 * Check recent crawl results for new errors
 */

import { supabase } from './src/utils/supabase.js';

async function checkRecentErrors() {
  console.log('🔍 Checking recent crawl results for new errors');
  console.log('================================================\n');

  // Get the most recent crawl run
  const { data: recentRun, error: runError } = await supabase
    .from('crawl_runs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (runError || !recentRun) {
    console.error('❌ No recent crawl runs found:', runError);
    return;
  }

  console.log('📋 Most Recent Crawl Run:');
  console.log('  Run ID:', recentRun.id);
  console.log('  Created:', new Date(recentRun.created_at).toISOString());
  console.log('  Status:', recentRun.status);
  console.log('  Total Properties:', recentRun.total_properties);
  console.log('  Valid Properties:', recentRun.valid_properties);
  console.log('  Invalid Properties:', recentRun.invalid_properties);
  console.log('\n');

  // Get crawl results with errors from the most recent run
  const { data: errorResults, error: resultsError } = await supabase
    .from('crawl_results')
    .select('*')
    .eq('run_id', recentRun.id)
    .eq('is_valid', false)
    .order('created_at', { ascending: false })
    .limit(10);

  if (resultsError) {
    console.error('❌ Error fetching results:', resultsError);
    return;
  }

  if (!errorResults || errorResults.length === 0) {
    console.log('✅ No errors found in the most recent run');
    return;
  }

  console.log(`❌ Found ${errorResults.length} properties with errors:\n`);

  errorResults.forEach((result, index) => {
    console.log(`\n${index + 1}. ${result.property_name || 'Unknown Property'}`);
    console.log('   Property ID:', result.property_id);
    console.log('   URL:', result.url);
    console.log('   Issues:');

    if (result.issues && Array.isArray(result.issues)) {
      result.issues.forEach(issue => {
        console.log(`     - ${issue.type}: ${issue.message} (${issue.severity})`);
        if (issue.expected && issue.actual) {
          console.log(`       Expected: ${issue.expected}, Actual: ${issue.actual}`);
        }
      });
    }
  });

  // Check for properties that were valid before but are now invalid
  console.log('\n\n🔄 Checking for properties that changed from valid to invalid...\n');

  for (const errorResult of errorResults.slice(0, 5)) { // Check top 5 errors
    // Get previous result for this property
    const { data: previousResults, error: prevError } = await supabase
      .from('crawl_results')
      .select('is_valid, created_at')
      .eq('property_id', errorResult.property_id)
      .neq('run_id', recentRun.id)
      .order('created_at', { ascending: false })
      .limit(1);

    if (!prevError && previousResults && previousResults.length > 0) {
      const prevResult = previousResults[0];
      if (prevResult.is_valid && !errorResult.is_valid) {
        console.log(`⚠️ NEWLY FAILED: ${errorResult.property_name}`);
        console.log(`   Was valid on: ${new Date(prevResult.created_at).toISOString()}`);
        console.log(`   Now invalid with issues:`);
        if (errorResult.issues && Array.isArray(errorResult.issues)) {
          errorResult.issues.forEach(issue => {
            console.log(`     - ${issue.type}: ${issue.message}`);
          });
        }
        console.log('');
      }
    }
  }

  process.exit(0);
}

// Run the check
checkRecentErrors().catch(console.error);