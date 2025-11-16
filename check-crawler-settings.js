import supabase from './src/utils/supabase.js';

async function checkSettings() {
  console.log('\n🔍 Checking crawler_settings table...\n');

  const { data, error } = await supabase
    .from('crawler_settings')
    .select('*')
    .single();

  if (error) {
    console.log('❌ Error:', error.message);
    console.log('\n📋 Default values:');
    console.log('   Phase 1 Timeout: 20 seconds');
    console.log('   Phase 2 Timeout: 60 seconds');
    return;
  }

  if (data) {
    console.log('✅ Crawler Settings from Database:\n');
    console.log(`   Phase 1 Timeout: ${data.phase1_timeout} seconds`);
    console.log(`   Phase 2 Timeout: ${data.phase2_timeout} seconds`);
    console.log(`   Updated at: ${data.updated_at || 'N/A'}`);
  } else {
    console.log('⚠️ No settings found in database');
    console.log('   Using defaults: Phase 1 = 20s, Phase 2 = 60s');
  }
}

checkSettings().catch(console.error);
