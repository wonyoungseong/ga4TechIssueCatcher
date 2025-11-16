import supabase from './src/utils/supabase.js';

async function queryByRunId() {
  const runId = 'b9252111-cc4a-4f2b-8e22-7eeb0762a6c3';

  console.log(`\n${'='.repeat(80)}`);
  console.log(`Searching for Run ID: ${runId}`);
  console.log('='.repeat(80));

  // Try finding by run_id
  const { data: results, error } = await supabase
    .from('crawl_results')
    .select('*')
    .eq('run_id', runId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error:', error);
    return;
  }

  if (!results || results.length === 0) {
    console.log('❌ No results found for this run_id');

    // Try as a crawl result ID instead
    const { data: singleResult } = await supabase
      .from('crawl_results')
      .select('*')
      .eq('id', runId)
      .single();

    if (singleResult) {
      console.log('\n✅ Found as crawl result ID');
      results.push(singleResult);
    } else {
      return;
    }
  }

  console.log(`\n✅ Found ${results.length} crawl result(s)\n`);

  for (const result of results) {
    // Get property info
    const { data: property } = await supabase
      .from('properties')
      .select('*')
      .eq('id', result.property_id)
      .single();

    console.log(`\n${'='.repeat(80)}`);
    console.log(`Property: ${property?.name || 'Unknown'} (${property?.url || 'No URL'})`);
    console.log(`Crawl Result ID: ${result.id}`);
    console.log(`Created: ${result.created_at}`);
    console.log('='.repeat(80));

    if (result.raw_data) {
      const rawData = typeof result.raw_data === 'string' ? JSON.parse(result.raw_data) : result.raw_data;

      console.log(`\n📊 Validation Result:`);
      console.log(`   Is Valid: ${rawData.isValid}`);
      console.log(`   Severity: ${rawData.severity}`);
      console.log(`   Measurement ID: ${rawData.measurementId || 'N/A'}`);
      console.log(`   GTM ID: ${rawData.gtmId || 'N/A'}`);

      if (rawData.validationDetails) {
        console.log(`\n📋 Validation Details:`);
        console.log(JSON.stringify(rawData.validationDetails, null, 2));
      }

      if (rawData.issues && rawData.issues.length > 0) {
        console.log(`\n⚠️  Issues (${rawData.issues.length}):`);
        rawData.issues.forEach((issue, index) => {
          console.log(`   ${index + 1}. ${issue}`);
        });
      }

      if (rawData.debugInfo) {
        console.log(`\n🔍 Debug Info:`);
        console.log(JSON.stringify(rawData.debugInfo, null, 2));
      }

      if (rawData.events) {
        console.log(`\n📨 GA4 Events Captured (${rawData.events?.length || 0}):`);
        if (rawData.events && rawData.events.length > 0) {
          rawData.events.slice(0, 5).forEach((event, index) => {
            console.log(`   ${index + 1}. ${event.event_name || event.eventName || 'unknown'}`);
          });
          if (rawData.events.length > 5) {
            console.log(`   ... and ${rawData.events.length - 5} more`);
          }
        }
      }
    } else {
      console.log('\n❌ No raw_data found');
    }
  }
}

queryByRunId().catch(console.error);
