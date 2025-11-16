import { supabase } from './src/utils/supabase.js';

async function checkResults() {
  // Check crawl_results table
  const { data: results, error: resultsError, count } = await supabase
    .from('crawl_results')
    .select('*', { count: 'exact' })
    .eq('crawl_run_id', '3cc3b383-c527-4dc9-b9e9-97d30f80f56a')
    .order('created_at', { ascending: false });

  if (resultsError) {
    console.error('❌ Error querying results:', resultsError);
    return;
  }

  console.log('\n📊 Crawl Results Count:', count);

  if (results && results.length > 0) {
    console.log('\n✅ Sample results:');
    results.slice(0, 3).forEach(r => {
      console.log('  -', r.property_name + ':', r.validation_status, '(' + r.execution_time_ms + 'ms)');
    });
  } else {
    console.log('\n⚠️ No results found in database yet');
  }

  // Check crawl_run status
  const { data: run, error: runError } = await supabase
    .from('crawl_runs')
    .select('*')
    .eq('id', '3cc3b383-c527-4dc9-b9e9-97d30f80f56a')
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
