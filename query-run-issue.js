import supabase from './src/utils/supabase.js';

async function queryRunIssue() {
  const runId = '31ebd71c-06ff-4d9c-94c6-03b76869a940';

  console.log(`\n${'='.repeat(80)}`);
  console.log(`Searching for Run ID: ${runId}`);
  console.log('='.repeat(80));

  // Get all results for this run
  const { data: results, error } = await supabase
    .from('crawl_results')
    .select('*')
    .eq('crawl_run_id', runId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error:', error);
    return;
  }

  if (!results || results.length === 0) {
    console.log('❌ No results found for this crawl_run_id');
    return;
  }

  console.log(`\n✅ Found ${results.length} crawl results\n`);

  // Count by status
  const statusCounts = {};
  const issueCounts = {};

  for (const result of results) {
    // Get property info
    const { data: property } = await supabase
      .from('properties')
      .select('*')
      .eq('id', result.property_id)
      .single();

    // Use schema columns: validation_status, has_issues, issue_types, issue_summary
    const validationStatus = result.validation_status; // 'passed', 'failed', 'error'
    const hasIssues = result.has_issues;
    const issueTypes = result.issue_types || [];
    const issueSummary = result.issue_summary;
    const phase = result.phase;

    statusCounts[validationStatus] = (statusCounts[validationStatus] || 0) + 1;

    if (hasIssues && issueTypes.length > 0) {
      issueTypes.forEach(issueType => {
        issueCounts[issueType] = (issueCounts[issueType] || 0) + 1;
      });
    }

    const statusEmoji = validationStatus === 'passed' ? '✅' : '❌';
    console.log(`${statusEmoji} ${property?.property_name || 'Unknown'} - Phase ${phase || 'N/A'} - ${validationStatus}`);

    if (hasIssues) {
      if (issueTypes.length > 0) {
        console.log(`   Issue Types: ${issueTypes.join(', ')}`);
      }
      if (issueSummary) {
        console.log(`   Summary: ${issueSummary}`);
      }
    }
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log('📊 Summary');
  console.log('='.repeat(80));
  console.log(`Total Results: ${results.length}`);
  console.log(`\nStatus Breakdown:`);
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`  ${status}: ${count} (${(count/results.length*100).toFixed(1)}%)`);
  });

  if (Object.keys(issueCounts).length > 0) {
    console.log(`\nIssue Types:`);
    Object.entries(issueCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
      });
  }

  // Show phase breakdown
  const phaseCounts = {};
  results.forEach(r => {
    const phase = r.phase || 'unknown';
    phaseCounts[phase] = (phaseCounts[phase] || 0) + 1;
  });

  console.log(`\nPhase Breakdown:`);
  Object.entries(phaseCounts).forEach(([phase, count]) => {
    console.log(`  Phase ${phase}: ${count}`);
  });
}

queryRunIssue().catch(console.error);
