/**
 * Find the actual missing property by comparing all properties vs results
 */

import { supabase, Tables } from './src/utils/supabase.js';

const runId = '274d6c26-29eb-4716-989b-8ad1a24e4646';

async function findActualMissing() {
  // Get all active properties
  const { data: allProperties, error: propError } = await supabase
    .from(Tables.PROPERTIES)
    .select('id, property_name, brand, slug')
    .eq('is_active', true)
    .order('property_name');

  if (propError) {
    console.error('Error fetching properties:', propError);
    return;
  }

  // Get all results for this run
  const { data: results, error: resultsError } = await supabase
    .from(Tables.CRAWL_RESULTS)
    .select('property_id')
    .eq('crawl_run_id', runId);

  if (resultsError) {
    console.error('Error fetching results:', resultsError);
    return;
  }

  console.log(`\n📊 Property Analysis for Run ${runId}:\n`);
  console.log(`Total Properties (is_active=true): ${allProperties.length}`);
  console.log(`Total Results in DB: ${results.length}`);
  console.log(`Missing: ${allProperties.length - results.length}\n`);

  // Find missing
  const processedPropertyIds = new Set(results.map(r => r.property_id));
  const missingProperties = allProperties.filter(p => !processedPropertyIds.has(p.id));

  if (missingProperties.length === 0) {
    console.log('✅ All properties have results!');
  } else {
    console.log(`❌ Missing ${missingProperties.length} properties:\n`);
    missingProperties.forEach((prop, index) => {
      console.log(`${index + 1}. ${prop.property_name} (${prop.brand || 'N/A'})`);
      console.log(`   ID: ${prop.id}`);
      console.log(`   Slug: ${prop.slug}\n`);
    });
  }

  // Also check if any results reference non-existent properties
  const allPropertyIds = new Set(allProperties.map(p => p.id));
  const orphanResults = results.filter(r => !allPropertyIds.has(r.property_id));

  if (orphanResults.length > 0) {
    console.log(`\n⚠️ Found ${orphanResults.length} results referencing non-existent or inactive properties!`);
  }
}

findActualMissing().catch(console.error);
