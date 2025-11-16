import supabase from './src/utils/supabase.js';

async function testDebuggingStats() {
  // Get latest crawl run
  const { data: latestRun } = await supabase
    .from('crawl_runs')
    .select('id')
    .order('started_at', { ascending: false })
    .limit(1)
    .single();

  console.log('Latest run ID:', latestRun.id);

  // Get ALL validation results
  const { data: allResults } = await supabase
    .from('crawl_results')
    .select('property_id, has_issues, validation_status, phase')
    .eq('crawl_run_id', latestRun.id);

  // Get ALL active properties with their manual status
  const { data: allProperties } = await supabase
    .from('properties')
    .select('id, current_status')
    .eq('is_active', true);

  console.log('Total validation results:', allResults.length);
  console.log('Total active properties:', allProperties.length);

  // Group validation results by property_id
  const byProperty = {};
  allResults.forEach(r => {
    if (!byProperty[r.property_id]) {
      byProperty[r.property_id] = [];
    }
    byProperty[r.property_id].push(r);
  });

  // Create property status map for manual debugging status
  const propertyStatusMap = {};
  allProperties.forEach(p => {
    propertyStatusMap[p.id] = p.current_status;
  });

  // Apply precedence rule: Manual debugging > Phase 2 > Phase 1
  const issuePropertyIds = new Set();
  const normalPropertyIds = new Set();
  const debuggingPropertyIds = new Set();

  for (const [propertyId, results] of Object.entries(byProperty)) {
    // Check manual debugging status first (highest priority)
    if (propertyStatusMap[propertyId] === 'debugging') {
      debuggingPropertyIds.add(propertyId);
      continue;
    }

    // Apply validation result precedence: Phase 2 > Phase 1
    const phase2 = results.find(r => r.phase === 2);
    const finalResult = phase2 || results[0];

    if (finalResult.has_issues || finalResult.validation_status === 'failed') {
      issuePropertyIds.add(propertyId);
    } else if (finalResult.validation_status === 'passed' && !finalResult.has_issues) {
      normalPropertyIds.add(propertyId);
    }
  }

  console.log('\n=== Final Stats with Debugging ===');
  console.log('Normal:', normalPropertyIds.size);
  console.log('Issue:', issuePropertyIds.size);
  console.log('Debugging:', debuggingPropertyIds.size);
  console.log('Sum:', normalPropertyIds.size + issuePropertyIds.size + debuggingPropertyIds.size);

  // Check overlap (should be 0)
  const normalIssueOverlap = [...normalPropertyIds].filter(id => issuePropertyIds.has(id));
  const normalDebugOverlap = [...normalPropertyIds].filter(id => debuggingPropertyIds.has(id));
  const issueDebugOverlap = [...issuePropertyIds].filter(id => debuggingPropertyIds.has(id));

  console.log('\n=== Overlap Check ===');
  console.log('Normal & Issue:', normalIssueOverlap.length);
  console.log('Normal & Debugging:', normalDebugOverlap.length);
  console.log('Issue & Debugging:', issueDebugOverlap.length);

  console.log('\n=== Total Check ===');
  console.log('Expected total:', allProperties.length);
  console.log('Actual sum:', normalPropertyIds.size + issuePropertyIds.size + debuggingPropertyIds.size);
  console.log('Match:', allProperties.length === (normalPropertyIds.size + issuePropertyIds.size + debuggingPropertyIds.size) ? '✅' : '❌');
}

testDebuggingStats();
