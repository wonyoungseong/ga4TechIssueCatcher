#!/usr/bin/env node
import supabase from './src/utils/supabase.js';

const runId = '30b02e1b-dfc9-44dd-a448-3f089199a069';

console.log('\n' + '='.repeat(80));
console.log('🔍 Run Settings Investigation');
console.log('='.repeat(80));
console.log(`Run ID: ${runId}\n`);

// Get run info
const { data: run, error: runError } = await supabase
  .from('crawl_runs')
  .select('*')
  .eq('id', runId)
  .single();

if (runError) {
  console.error('❌ Error:', runError.message);
  process.exit(1);
}

console.log('📊 Run Information:');
console.log(`   Status: ${run.status}`);
console.log(`   Started: ${run.started_at}`);
console.log(`   Completed: ${run.completed_at || 'N/A'}`);
console.log(`   Duration: ${run.duration_seconds || 'N/A'}s`);
console.log(`   Total Properties: ${run.total_properties || 0}`);
console.log(`   Passed: ${run.completed_properties || 0}`);
console.log(`   Failed: ${run.failed_properties || 0}`);

if (run.crawler_settings_id) {
  console.log(`\n📋 Crawler Settings ID: ${run.crawler_settings_id}`);
  
  // Get crawler settings
  const { data: settings, error: settingsError } = await supabase
    .from('crawler_settings')
    .select('*')
    .eq('id', run.crawler_settings_id)
    .single();
  
  if (settingsError) {
    console.error('   ❌ Error getting settings:', settingsError.message);
  } else {
    console.log('\n⚙️  Crawler Settings:');
    console.log(`   Phase 1 Timeout: ${settings.phase1_timeout}ms (${settings.phase1_timeout / 1000}s)`);
    console.log(`   Phase 2 Timeout: ${settings.phase2_timeout}ms (${settings.phase2_timeout / 1000}s)`);
    console.log(`   Max Concurrent: ${settings.max_concurrent}`);
    console.log(`   Retry Count: ${settings.retry_count}`);
    console.log(`   User Agent: ${settings.user_agent ? settings.user_agent.substring(0, 50) + '...' : 'N/A'}`);
  }
} else {
  console.log('\n⚠️  No crawler settings ID found');
}

console.log('\n' + '='.repeat(80) + '\n');
