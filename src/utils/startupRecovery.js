/**
 * Startup Recovery Utility
 *
 * Detects and recovers incomplete crawl runs on server startup.
 * Prevents data inconsistency issues when server is restarted during crawl execution.
 */

import supabase from './supabase.js';

/**
 * Recover incomplete crawl runs
 *
 * Finds all runs with status='running' and updates them with actual statistics
 * from crawl_results table. Also removes duplicate results.
 *
 * @returns {Promise<Object>} Recovery summary {recovered: number, duplicatesRemoved: number}
 */
export async function recoverIncompleteCrawls() {
  console.log('🔍 Checking for incomplete crawl runs...');

  try {
    // Find all runs with status='running'
    const { data: runningRuns, error: runError } = await supabase
      .from('crawl_runs')
      .select('*')
      .eq('status', 'running');

    if (runError) {
      console.error('❌ Error checking for incomplete runs:', runError.message);
      return { recovered: 0, duplicatesRemoved: 0, error: runError.message };
    }

    if (!runningRuns || runningRuns.length === 0) {
      console.log('✅ No incomplete crawl runs found');
      return { recovered: 0, duplicatesRemoved: 0 };
    }

    console.log(`⚠️  Found ${runningRuns.length} incomplete crawl run(s)`);

    let totalRecovered = 0;
    let totalDuplicatesRemoved = 0;

    for (const run of runningRuns) {
      console.log(`\n📋 Recovering run: ${run.id}`);

      // Get all results for this run
      const { data: results, error: resultsError } = await supabase
        .from('crawl_results')
        .select('id, property_id, validation_status, has_issues, created_at')
        .eq('crawl_run_id', run.id)
        .order('property_id')
        .order('created_at', { ascending: false });

      if (resultsError) {
        console.error(`   ❌ Error fetching results for run ${run.id}:`, resultsError.message);
        continue;
      }

      if (!results || results.length === 0) {
        console.log(`   ℹ️  No results found for this run - marking as failed`);

        // Mark run as failed if no results
        await supabase
          .from('crawl_runs')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error_message: 'No results found - recovered by startup recovery'
          })
          .eq('id', run.id);

        totalRecovered++;
        continue;
      }

      // Remove duplicates (keep newest per property_id)
      const seen = new Set();
      const toDelete = [];
      const uniqueResults = [];

      results.forEach(r => {
        if (seen.has(r.property_id)) {
          toDelete.push(r.id); // This is an older duplicate
        } else {
          seen.add(r.property_id);
          uniqueResults.push(r); // Keep the newest
        }
      });

      // Delete duplicates if found
      if (toDelete.length > 0) {
        console.log(`   🗑️  Removing ${toDelete.length} duplicate result(s)`);

        const { error: deleteError } = await supabase
          .from('crawl_results')
          .delete()
          .in('id', toDelete);

        if (deleteError) {
          console.error(`   ❌ Error deleting duplicates:`, deleteError.message);
        } else {
          totalDuplicatesRemoved += toDelete.length;
        }
      }

      // Calculate actual statistics from unique results
      const passed = uniqueResults.filter(r => r.validation_status === 'passed').length;
      const failed = uniqueResults.filter(r => r.validation_status !== 'passed').length;
      const withIssues = uniqueResults.filter(r => r.has_issues === true).length;

      console.log(`   📊 Statistics: ${passed} passed, ${failed} failed, ${withIssues} with issues`);

      // **SOLUTION: Check if Phase 2 is needed for this run**
      // Get full results with phase and validation_status
      const { data: fullResults, error: fullError } = await supabase
        .from('crawl_results')
        .select('phase, validation_status')
        .eq('crawl_run_id', run.id);

      if (!fullError && fullResults) {
        const phase1Timeouts = fullResults.filter(r => r.phase === 1 && r.validation_status === 'timeout').length;
        const phase2Results = fullResults.filter(r => r.phase === 2).length;

        if (phase1Timeouts > 0 && phase2Results === 0) {
          console.log(`   ⚠️  WARNING: ${phase1Timeouts} properties timed out in Phase 1 but Phase 2 was never executed!`);
          console.log(`   ℹ️  These properties would have been retried with 80s timeout if Phase 2 had run.`);
          console.log(`   💡 Recommendation: Re-run this crawl to give timeout properties another chance.`);
        } else if (phase1Timeouts > 0 && phase2Results > 0) {
          console.log(`   ✅ Phase 2 was executed for ${phase2Results} properties (${phase1Timeouts} timed out in Phase 1)`);
        }
      }

      // Calculate duration (from started_at to now)
      const startTime = new Date(run.started_at);
      const now = new Date();
      const durationSeconds = Math.floor((now - startTime) / 1000);

      // Update crawl_runs with actual statistics
      const { error: updateError } = await supabase
        .from('crawl_runs')
        .update({
          status: 'completed',
          completed_at: now.toISOString(),
          duration_seconds: durationSeconds,
          total_properties: uniqueResults.length,
          completed_properties: passed,
          failed_properties: failed,
          properties_with_issues: withIssues,
          error_message: 'Recovered by startup recovery - server was restarted during execution'
        })
        .eq('id', run.id);

      if (updateError) {
        console.error(`   ❌ Error updating run:`, updateError.message);
      } else {
        console.log(`   ✅ Run recovered successfully`);
        totalRecovered++;
      }
    }

    console.log(`\n✅ Recovery complete: ${totalRecovered} run(s) recovered, ${totalDuplicatesRemoved} duplicate(s) removed\n`);

    return {
      recovered: totalRecovered,
      duplicatesRemoved: totalDuplicatesRemoved
    };

  } catch (error) {
    console.error('❌ Startup recovery failed:', error.message);
    return {
      recovered: 0,
      duplicatesRemoved: 0,
      error: error.message
    };
  }
}

export default { recoverIncompleteCrawls };
