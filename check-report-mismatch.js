import supabase from './src/utils/supabase.js';

async function checkReportMismatch() {
  console.log('\n🔍 Checking Report Data Mismatch\n');
  console.log('='.repeat(80));

  // Get the latest crawl run
  const { data: latestRun, error: runError } = await supabase
    .from('crawl_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(1)
    .single();

  if (runError) {
    console.error('❌ Error fetching latest run:', runError);
    return;
  }

  console.log(`\n📊 Latest Crawl Run: ${latestRun.id}`);
  console.log(`   Started: ${latestRun.started_at}`);
  console.log(`   Status: ${latestRun.status}`);
  console.log('\n' + '='.repeat(80));

  console.log('\n1️⃣ Values from crawl_runs table:');
  console.log(`   total_properties: ${latestRun.total_properties}`);
  console.log(`   completed_properties: ${latestRun.completed_properties}`);
  console.log(`   failed_properties: ${latestRun.failed_properties}`);
  console.log(`   properties_with_issues: ${latestRun.properties_with_issues}`);

  // Get actual counts from crawl_results
  const { data: results, error: resultsError } = await supabase
    .from('crawl_results')
    .select('*')
    .eq('crawl_run_id', latestRun.id);

  if (resultsError) {
    console.error('❌ Error fetching results:', resultsError);
    return;
  }

  console.log('\n' + '='.repeat(80));
  console.log('\n2️⃣ Actual counts from crawl_results:');
  console.log(`   Total results: ${results.length}`);

  // Count by validation_status
  const statusCounts = {
    passed: 0,
    failed: 0,
    error: 0
  };

  results.forEach(result => {
    const status = result.validation_status;
    if (statusCounts[status] !== undefined) {
      statusCounts[status]++;
    }
  });

  console.log(`   Passed (validation_status='passed'): ${statusCounts.passed}`);
  console.log(`   Failed (validation_status='failed'): ${statusCounts.failed}`);
  console.log(`   Error (validation_status='error'): ${statusCounts.error}`);

  // Count properties with issues (has_issues = true)
  const propertiesWithIssues = results.filter(r => r.has_issues === true).length;
  console.log(`   Properties with issues (has_issues=true): ${propertiesWithIssues}`);

  // Count by phase
  const phaseCounts = { 1: 0, 2: 0, unknown: 0 };
  results.forEach(result => {
    const phase = result.phase;
    if (phase === 1 || phase === 2) {
      phaseCounts[phase]++;
    } else {
      phaseCounts.unknown++;
    }
  });

  console.log(`   Phase 1: ${phaseCounts[1]}`);
  console.log(`   Phase 2: ${phaseCounts[2]}`);

  console.log('\n' + '='.repeat(80));
  console.log('\n3️⃣ Comparison:');
  console.log('\n   Field Mapping (Expected):');
  console.log('   - completed_properties = passed (성공한 검증)');
  console.log('   - failed_properties = failed + error (실패한 검증)');
  console.log('   - properties_with_issues = has_issues=true (이슈가 있는 속성)');

  console.log('\n   Actual vs Expected:');

  const expectedCompleted = statusCounts.passed;
  const expectedFailed = statusCounts.failed + statusCounts.error;

  console.log(`\n   ✓ completed_properties:`);
  console.log(`     crawl_runs: ${latestRun.completed_properties}`);
  console.log(`     expected: ${expectedCompleted} (passed)`);
  console.log(`     match: ${latestRun.completed_properties === expectedCompleted ? '✅' : '❌'}`);

  console.log(`\n   ✓ failed_properties:`);
  console.log(`     crawl_runs: ${latestRun.failed_properties}`);
  console.log(`     expected: ${expectedFailed} (failed + error)`);
  console.log(`     match: ${latestRun.failed_properties === expectedFailed ? '✅' : '❌'}`);

  console.log(`\n   ✓ properties_with_issues:`);
  console.log(`     crawl_runs: ${latestRun.properties_with_issues}`);
  console.log(`     expected: ${propertiesWithIssues} (has_issues=true)`);
  console.log(`     match: ${latestRun.properties_with_issues === propertiesWithIssues ? '✅' : '❌'}`);

  console.log('\n' + '='.repeat(80));

  // Show issue types breakdown
  console.log('\n4️⃣ Issue Types Breakdown:');
  const issueTypeCounts = {};
  results.forEach(result => {
    if (result.issue_types && Array.isArray(result.issue_types)) {
      result.issue_types.forEach(type => {
        issueTypeCounts[type] = (issueTypeCounts[type] || 0) + 1;
      });
    }
  });

  Object.entries(issueTypeCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      console.log(`   ${type}: ${count}`);
    });

  console.log('\n' + '='.repeat(80) + '\n');
}

checkReportMismatch().catch(console.error);
