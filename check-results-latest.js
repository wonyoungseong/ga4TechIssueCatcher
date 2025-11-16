import { supabase } from './src/utils/supabase.js';

async function checkResults() {
  const runId = '37bfb8a4-aa31-43f0-a41e-b117e6f0a511';

  const { data: results, error, count } = await supabase
    .from('crawl_results')
    .select('*', { count: 'exact' })
    .eq('crawl_run_id', runId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log('\n📊 Results Count:', count);

  if (results && results.length > 0) {
    console.log('\n✅ Latest results with DATA:');
    results.slice(0, 2).forEach(r => {
      console.log('\n========================================');
      console.log('Property ID:', r.property_id);
      console.log('Status:', r.validation_status);
      console.log('✨ GA4 ID:', r.collected_ga4_id, '(SHOULD HAVE VALUE!)');
      console.log('✨ GTM ID:', r.collected_gtm_id, '(SHOULD HAVE VALUE!)');
      console.log('✨ Page view:', r.page_view_event_detected, '(SHOULD BE TRUE!)');
      console.log('✨ Duration:', r.validation_duration_ms, 'ms (SHOULD BE 3000-7000!)');
      console.log('Has issues:', r.has_issues);
      console.log('Screenshot:', r.screenshot_path);
      console.log('Created:', r.created_at);
    });
  } else {
    console.log('\n⚠️ No results found');
  }
}

checkResults().catch(console.error);
