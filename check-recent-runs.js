/**
 * Check recent runs to find which one generated the 20:58 logs
 */

import { supabase, Tables } from './src/utils/supabase.js';

async function checkRecentRuns() {
  const { data: runs, error } = await supabase
    .from(Tables.CRAWL_RUNS)
    .select('*')
    .order('started_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('\n📅 Recent Crawl Runs:\n');

  for (const run of runs) {
    const started = new Date(run.started_at);
    const kstTime = new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(started);

    console.log(`ID: ${run.id}`);
    console.log(`Started (KST): ${kstTime}`);
    console.log(`Status: ${run.status}`);
    console.log(`Total: ${run.total_properties}`);
    console.log(`Completed: ${run.completed_properties || 0}`);
    console.log(`Failed: ${run.failed_properties || 0}`);
    console.log('---\n');
  }
}

checkRecentRuns().catch(console.error);
