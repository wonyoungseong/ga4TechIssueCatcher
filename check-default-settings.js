#!/usr/bin/env node
import supabase from './src/utils/supabase.js';

console.log('\n' + '='.repeat(80));
console.log('🔍 Default Crawler Settings');
console.log('='.repeat(80));

// Get all crawler settings
const { data: allSettings, error: settingsError } = await supabase
  .from('crawler_settings')
  .select('*')
  .order('created_at', { ascending: false });

if (settingsError) {
  console.error('❌ Error:', settingsError.message);
  process.exit(1);
}

console.log(`\nFound ${allSettings.length} crawler setting(s):\n`);

allSettings.forEach((setting, idx) => {
  console.log(`${idx + 1}. ID: ${setting.id}`);
  console.log(`   Name: ${setting.name || 'N/A'}`);
  console.log(`   Phase 1 Timeout: ${setting.phase1_timeout}ms (${setting.phase1_timeout / 1000}s)`);
  console.log(`   Phase 2 Timeout: ${setting.phase2_timeout}ms (${setting.phase2_timeout / 1000}s)`);
  console.log(`   Max Concurrent: ${setting.max_concurrent}`);
  console.log(`   Retry Count: ${setting.retry_count}`);
  console.log(`   Created: ${setting.created_at}`);
  console.log();
});

console.log('='.repeat(80));
console.log('📋 Comparison with Run 30b02e1b-dfc9-44dd-a448-3f089199a069:');
console.log('   - Expected timeout for Phase 1: 10s');
console.log('   - Actual failure: "Timeout 80000ms exceeded"');
console.log('   - This suggests Phase 2 timeout (80s) was used in Phase 1');
console.log('='.repeat(80) + '\n');
