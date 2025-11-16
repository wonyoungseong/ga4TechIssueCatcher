/**
 * Find missing properties in a crawl run
 */

import { supabase, Tables } from './src/utils/supabase.js';

const runId = '274d6c26-29eb-4716-989b-8ad1a24e4646';

async function checkMissingProperties() {
  console.log(`\n🔍 Checking missing properties for run ID: ${runId}\n`);

  // Get crawl run details
  const { data: crawlRun, error: runError } = await supabase
    .from(Tables.CRAWL_RUNS)
    .select('total_properties')
    .eq('id', runId)
    .single();

  if (runError) {
    console.error('❌ Error fetching run:', runError.message);
    return;
  }

  console.log(`📊 Expected total properties: ${crawlRun.total_properties}`);

  // Get all properties
  const { data: allProperties, error: propsError } = await supabase
    .from(Tables.PROPERTIES)
    .select('id, property_name, brand')
    .order('property_name');

  if (propsError) {
    console.error('❌ Error fetching properties:', propsError.message);
    return;
  }

  console.log(`📊 Total properties in database: ${allProperties.length}\n`);

  // Get results for this run
  const { data: results, error: resultsError } = await supabase
    .from(Tables.CRAWL_RESULTS)
    .select('property_id')
    .eq('crawl_run_id', runId);

  if (resultsError) {
    console.error('❌ Error fetching results:', resultsError.message);
    return;
  }

  console.log(`📊 Properties with results: ${results.length}\n`);

  // Find missing properties
  const processedPropertyIds = new Set(results.map(r => r.property_id));
  const missingProperties = allProperties.filter(p => !processedPropertyIds.has(p.id));

  if (missingProperties.length === 0) {
    console.log('✅ No missing properties!');
  } else {
    console.log(`❌ Missing ${missingProperties.length} properties:\n`);
    missingProperties.forEach((prop, index) => {
      console.log(`  ${index + 1}. ${prop.property_name} (${prop.brand || 'N/A'})`);
      console.log(`     ID: ${prop.id}\n`);
    });
  }
}

checkMissingProperties().catch(console.error);
