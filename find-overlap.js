import supabase from './src/utils/supabase.js';

async function findOverlap() {
  const { data: run } = await supabase
    .from('crawl_runs')
    .select('id')
    .order('started_at', { ascending: false })
    .limit(1)
    .single();

  const { data: results } = await supabase
    .from('crawl_results')
    .select('property_id, has_issues, validation_status, phase')
    .eq('crawl_run_id', run.id);

  // Group by property_id
  const byProperty = {};
  results.forEach(r => {
    if (!byProperty[r.property_id]) {
      byProperty[r.property_id] = [];
    }
    byProperty[r.property_id].push(r);
  });

  // Find properties with conflicting statuses
  console.log('=== Properties with Multiple Results ===\n');

  for (const [propId, records] of Object.entries(byProperty)) {
    if (records.length > 1) {
      const hasIssue = records.some(r => r.has_issues || r.validation_status === 'failed');
      const hasNormal = records.some(r => !r.has_issues && r.validation_status === 'passed');

      if (hasIssue && hasNormal) {
        console.log(`Property: ${propId}`);
        records.forEach(r => {
          console.log(`  Phase ${r.phase}: validation_status=${r.validation_status}, has_issues=${r.has_issues}`);
        });
        console.log('');
      }
    }
  }
}

findOverlap();
