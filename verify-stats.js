import supabase from './src/utils/supabase.js';

async function verify() {
  const { data: run } = await supabase
    .from('crawl_runs')
    .select('id')
    .order('started_at', { ascending: false })
    .limit(1)
    .single();

  console.log('Latest run ID:', run.id);

  // Get all results for this run
  const { data: allResults } = await supabase
    .from('crawl_results')
    .select('property_id, has_issues, validation_status')
    .eq('crawl_run_id', run.id);

  console.log('Total result records:', allResults.length);

  // Count unique properties with issues
  const issuePropertyIds = new Set(
    allResults
      .filter(r => r.has_issues || r.validation_status === 'failed')
      .map(r => r.property_id)
  );

  // Count unique normal properties
  const normalPropertyIds = new Set(
    allResults
      .filter(r => !r.has_issues && r.validation_status === 'passed')
      .map(r => r.property_id)
  );

  console.log('Unique properties with issues:', issuePropertyIds.size);
  console.log('Unique normal properties:', normalPropertyIds.size);
  console.log('Total unique properties:', issuePropertyIds.size + normalPropertyIds.size);
}

verify();
