import { supabase } from './src/utils/supabase.js';

async function checkSchema() {
  // Get a sample row to see the actual columns
  const { data, error } = await supabase
    .from('crawl_results')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error:', error);

    // Try to get table info
    console.log('\nTrying to describe table...');
    const { data: tableInfo, error: infoError } = await supabase
      .rpc('get_table_columns', { table_name: 'crawl_results' })
      .catch(() => null);

    if (!tableInfo) {
      console.log('\nCannot query table. Checking if table exists...');
      // Just try an insert to see what columns are expected
      const { error: insertError } = await supabase
        .from('crawl_results')
        .insert({})
        .select();

      console.log('Insert error (shows required columns):', insertError);
    }
    return;
  }

  if (!data || data.length === 0) {
    console.log('No data in table. Columns cannot be determined from empty table.');
    console.log('Let me try to insert a test row to see what columns exist...');

    // Try minimal insert
    const { error: insertError } = await supabase
      .from('crawl_results')
      .insert({
        crawl_run_id: '00000000-0000-0000-0000-000000000000',
        property_id: '00000000-0000-0000-0000-000000000000'
      })
      .select();

    console.log('\nInsert error:', insertError);
    return;
  }

  console.log('\nTable columns:');
  Object.keys(data[0]).forEach(col => {
    console.log('  -', col, ':', typeof data[0][col]);
  });
}

checkSchema().catch(console.error);
