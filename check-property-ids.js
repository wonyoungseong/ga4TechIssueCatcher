/**
 * Check if missing properties have proper _supabaseId in cache
 */

import { supabase, Tables } from './src/utils/supabase.js';

const runId = '274d6c26-29eb-4716-989b-8ad1a24e4646';

const missingPropertyIds = [
  'ac3f4a2a-8fc2-4c28-9201-de5656ac1eab', // 데이터플레이스
  'dcc2ba21-0827-42c2-aecf-eec76edd62b0', // 아모레퍼시픽 공식 대시보드
  '1d3306c4-0e64-4ca2-b391-0ccfbf64c37e', // 옴니회원플랫폼
  '2a2b06d6-484b-4986-a99e-887afdb35aa1'  // 퍼시픽패키지
];

async function checkPropertyIds() {
  console.log('\n🔍 Checking missing property IDs...\n');

  // Check if these properties exist in the properties table
  const { data: properties, error } = await supabase
    .from(Tables.PROPERTIES)
    .select('*')
    .in('id', missingPropertyIds);

  if (error) {
    console.error('❌ Error fetching properties:', error);
    return;
  }

  console.log(`Found ${properties.length}/4 properties in database:\n`);

  for (const prop of properties) {
    console.log(`✅ ${prop.property_name}`);
    console.log(`   ID: ${prop.id}`);
    console.log(`   Slug: ${prop.slug}`);
    console.log(`   URL: ${prop.url}\n`);
  }

  // Check if these properties have results in this run
  const { data: results, error: resultsError } = await supabase
    .from(Tables.CRAWL_RESULTS)
    .select('*')
    .eq('crawl_run_id', runId)
    .in('property_id', missingPropertyIds);

  if (resultsError) {
    console.error('❌ Error fetching results:', resultsError);
    return;
  }

  console.log(`\nResults for these properties in run ${runId}:`);
  console.log(`Found: ${results.length}/4\n`);

  if (results.length === 0) {
    console.log('❌ None of the 4 missing properties have results in this run!');
    console.log('\nThis confirms these properties were never uploaded to the database.');
    console.log('They were either:');
    console.log('  1. Never added to cache (validation failed early)');
    console.log('  2. Added to cache but filtered out during batch upload');
    console.log('  3. Batch upload failed for these specific properties');
  }
}

checkPropertyIds().catch(console.error);
