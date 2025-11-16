import { supabase } from './src/utils/supabase.js';

async function checkResults() {
  const runId = 'ae015c56-b5a2-4244-9870-43cdda9c60ec';

  // Check crawl_results table
  const { data: results, error: resultsError, count } = await supabase
    .from('crawl_results')
    .select('*', { count: 'exact' })
    .eq('crawl_run_id', runId)
    .order('created_at', { ascending: false });

  if (resultsError) {
    console.error('❌ Error querying results:', resultsError);
    return;
  }

  console.log('\n📊 Crawl Results Count:', count);

  if (results && results.length > 0) {
    console.log('\n✅ Sample results with full schema:');
    results.slice(0, 3).forEach(r => {
      console.log('\n---');
      console.log('Property ID:', r.property_id);
      console.log('Status:', r.validation_status);
      console.log('GA4 ID:', r.collected_ga4_id);
      console.log('GTM ID:', r.collected_gtm_id);
      console.log('Page view detected:', r.page_view_event_detected);
      console.log('Has issues:', r.has_issues);
      console.log('Issue types:', r.issue_types);
      console.log('Issue summary:', r.issue_summary);
      console.log('Duration (ms):', r.validation_duration_ms);
      console.log('Screenshot:', r.screenshot_path);
      console.log('Phase:', r.phase);
      console.log('Created at:', r.created_at);
    });
  } else {
    console.log('\n⚠️ No results found in database');
  }

  // Check crawl_run status
  const { data: run, error: runError } = await supabase
    .from('crawl_runs')
    .select('*')
    .eq('id', runId)
    .single();

  if (runError) {
    console.error('❌ Error querying run:', runError);
    return;
  }

  console.log('\n📈 Crawl Run Status:');
  console.log('  Status:', run.status);
  console.log('  Total:', run.total_properties);
  console.log('  Completed:', run.completed_properties || 0);
  console.log('  Failed:', run.failed_properties || 0);
}

checkResults().catch(console.error);
