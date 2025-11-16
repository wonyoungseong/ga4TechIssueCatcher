import supabase from './src/utils/supabase.js';

async function investigate() {
  // Check total active properties
  const { count: totalActive } = await supabase
    .from('properties')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true);

  console.log('=== Total Active Properties ===');
  console.log('Total active properties:', totalActive);

  // Check latest crawl run
  const { data: run } = await supabase
    .from('crawl_runs')
    .select('id, total_properties')
    .order('started_at', { ascending: false })
    .limit(1)
    .single();

  console.log('\n=== Latest Crawl Run ===');
  console.log('Latest run ID:', run.id);
  console.log('Total properties in run:', run.total_properties);

  // Check all unique properties in this run
  const { data: results } = await supabase
    .from('crawl_results')
    .select('property_id, has_issues, validation_status')
    .eq('crawl_run_id', run.id);

  const allPropertyIds = new Set(results.map(r => r.property_id));
  console.log('Unique properties in results:', allPropertyIds.size);

  // Count by status
  const issueIds = new Set(
    results.filter(r => r.has_issues || r.validation_status === 'failed').map(r => r.property_id)
  );
  const normalIds = new Set(
    results.filter(r => !r.has_issues && r.validation_status === 'passed').map(r => r.property_id)
  );

  console.log('\n=== Status Breakdown ===');
  console.log('Issue properties:', issueIds.size);
  console.log('Normal properties:', normalIds.size);
  console.log('Sum (issue + normal):', issueIds.size + normalIds.size);

  // Check if there's overlap (shouldn't be)
  const overlap = [...issueIds].filter(id => normalIds.has(id));
  console.log('Overlap (in both normal & issue):', overlap.length);

  // Check properties not in latest run
  const notInRun = totalActive - allPropertyIds.size;
  console.log('\n=== Missing Properties ===');
  console.log('Properties not in latest run:', notInRun);

  // Expected total
  console.log('\n=== Expected vs Actual ===');
  console.log('Expected total:', totalActive);
  console.log('Actual sum (normal + issue):', normalIds.size + issueIds.size);
  console.log('Missing from sum:', totalActive - (normalIds.size + issueIds.size));
}

investigate();
