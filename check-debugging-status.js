import supabase from './src/utils/supabase.js';

async function checkDebugging() {
  // Check properties table
  const { data: debugProps, error: propError } = await supabase
    .from('properties')
    .select('id, name, current_status')
    .eq('is_active', true)
    .eq('current_status', 'debugging');

  console.log('=== Properties Table (current_status=debugging) ===');
  if (propError) {
    console.log('Error:', propError.message);
  } else {
    console.log('Count:', debugProps?.length || 0);
    if (debugProps && debugProps.length > 0) {
      debugProps.forEach(p => console.log('-', p.name, ':', p.current_status));
    }
  }

  // Check all current_status values
  const { data: allProps } = await supabase
    .from('properties')
    .select('current_status')
    .eq('is_active', true);

  console.log('\n=== All current_status values ===');
  const statusCounts = {};
  allProps.forEach(p => {
    statusCounts[p.current_status] = (statusCounts[p.current_status] || 0) + 1;
  });
  console.log(statusCounts);

  // Check crawl_results validation_status
  const { data: run } = await supabase
    .from('crawl_runs')
    .select('id')
    .order('started_at', { ascending: false })
    .limit(1)
    .single();

  const { data: results } = await supabase
    .from('crawl_results')
    .select('validation_status')
    .eq('crawl_run_id', run.id);

  console.log('\n=== Crawl Results validation_status ===');
  const validationCounts = {};
  results.forEach(r => {
    validationCounts[r.validation_status] = (validationCounts[r.validation_status] || 0) + 1;
  });
  console.log(validationCounts);
}

checkDebugging();
