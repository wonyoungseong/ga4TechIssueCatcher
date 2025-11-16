/**
 * Check when run 274d6c26 actually ran
 */

import { supabase, Tables } from './src/utils/supabase.js';

const runId = '274d6c26-29eb-4716-989b-8ad1a24e4646';

async function checkRunTime() {
  const { data: run, error } = await supabase
    .from(Tables.CRAWL_RUNS)
    .select('*')
    .eq('id', runId)
    .single();

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('\n📅 Run 274d6c26 Details:\n');
  console.log(`Started: ${run.started_at}`);
  console.log(`Completed: ${run.completed_at}`);
  console.log(`Status: ${run.status}`);
  console.log(`Total Properties: ${run.total_properties}`);
  console.log(`Duration: ${run.duration_seconds}s\n`);

  // Count actual results
  const { data: results, error: countError } = await supabase
    .from(Tables.CRAWL_RESULTS)
    .select('id')
    .eq('crawl_run_id', runId);

  if (!countError) {
    console.log(`Actual Results in DB: ${results.length}\n`);
  }
}

checkRunTime().catch(console.error);
