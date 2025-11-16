import supabase from './src/utils/supabase.js';

async function testPrecedence() {
  // Get latest crawl run
  const { data: latestRun } = await supabase
    .from('crawl_runs')
    .select('id')
    .order('started_at', { ascending: false })
    .limit(1)
    .single();

  console.log('Latest run ID:', latestRun.id);

  // Get ALL results
  const { data: allResults } = await supabase
    .from('crawl_results')
    .select('property_id, has_issues, validation_status, phase')
    .eq('crawl_run_id', latestRun.id);

  console.log('Total result records:', allResults.length);

  // Group by property_id
  const byProperty = {};
  allResults.forEach(r => {
    if (!byProperty[r.property_id]) {
      byProperty[r.property_id] = [];
    }
    byProperty[r.property_id].push(r);
  });

  console.log('Unique properties in results:', Object.keys(byProperty).length);

  // Apply precedence rule
  const issuePropertyIds = new Set();
  const normalPropertyIds = new Set();

  for (const [propertyId, results] of Object.entries(byProperty)) {
    // Check if there's a Phase 2 result (most authoritative)
    const phase2 = results.find(r => r.phase === 2);
    const finalResult = phase2 || results[0];

    if (finalResult.has_issues || finalResult.validation_status === 'failed') {
      issuePropertyIds.add(propertyId);
    } else if (finalResult.validation_status === 'passed' && !finalResult.has_issues) {
      normalPropertyIds.add(propertyId);
    }
  }

  console.log('\n=== With Precedence Rule (Phase 2 > Phase 1) ===');
  console.log('Issue properties:', issuePropertyIds.size);
  console.log('Normal properties:', normalPropertyIds.size);
  console.log('Sum:', issuePropertyIds.size + normalPropertyIds.size);

  // Check overlap (should be 0 now)
  const overlap = [...issuePropertyIds].filter(id => normalPropertyIds.has(id));
  console.log('Overlap (should be 0):', overlap.length);

  // Get total active properties for comparison
  const { count: totalActive } = await supabase
    .from('properties')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true);

  console.log('\n=== Total Check ===');
  console.log('Total active properties:', totalActive);
  console.log('Sum (normal + issue):', normalPropertyIds.size + issuePropertyIds.size);
  console.log('Match:', totalActive === (normalPropertyIds.size + issuePropertyIds.size) ? '✅' : '❌');
}

testPrecedence();
