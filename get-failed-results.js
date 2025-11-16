/**
 * Get failed results from a crawl run
 */

import { supabase } from './src/utils/supabase.js';

const runId = '71840829-8f69-4266-9716-8378e10beb6e';

async function getFailedResults() {
  console.log(`\nFetching failed results for run: ${runId}\n`);

  const { data, error } = await supabase
    .from('crawl_results')
    .select(`
      validation_status,
      validation_duration_ms,
      phase,
      has_issues,
      issue_types,
      issue_summary,
      properties!inner (
        property_name,
        url
      )
    `)
    .eq('crawl_run_id', runId)
    .eq('validation_status', 'failed');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Found ${data.length} failed properties:\n`);

  data.forEach((result, index) => {
    const prop = result.properties;
    console.log(`${index + 1}. ${prop.property_name}`);
    console.log(`   URL: ${prop.url}`);
    console.log(`   Status: ${result.validation_status}`);
    console.log(`   Phase: ${result.phase}`);
    console.log(`   Duration: ${result.validation_duration_ms}ms`);
    console.log(`   Has Issues: ${result.has_issues}`);

    if (result.issue_types && result.issue_types.length > 0) {
      console.log(`   Issue Types: ${result.issue_types.join(', ')}`);
    }

    if (result.issue_summary) {
      console.log(`   Summary: ${result.issue_summary}`);
    }
    console.log('');
  });

  // Return first 3 for testing
  return data.slice(0, 3);
}

getFailedResults()
  .then(results => {
    if (results && results.length > 0) {
      console.log('\n='.repeat(60));
      console.log('First 3 failed properties for Playwright testing:');
      console.log('='.repeat(60));
      results.forEach((r, i) => {
        console.log(`${i + 1}. ${r.properties.property_name}: ${r.properties.url}`);
      });
    }
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
