import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const runId = 'b934ba89-edc4-409f-9fea-5b19476f6448';

async function checkNullStatus() {
  console.log('\n=== Checking NULL validation_status ===\n');

  // Get all results for this run
  const { data: results, error } = await supabase
    .from('crawl_results')
    .select('property_id, validation_status, has_issues, screenshot_url, created_at')
    .eq('crawl_run_id', runId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error:', error);
    return;
  }

  // Check if validation_status is NULL or empty
  const withNullStatus = results.filter(r => !r.validation_status);
  const withStatus = results.filter(r => r.validation_status);

  console.log(`Total results: ${results.length}`);
  console.log(`With validation_status: ${withStatus.length}`);
  console.log(`Without validation_status (NULL/empty): ${withNullStatus.length}`);

  if (withNullStatus.length > 0) {
    console.log('\n❌ Properties WITHOUT validation_status:');
    withNullStatus.forEach((r, idx) => {
      console.log(`  ${idx + 1}. ${r.property_id}`);
      console.log(`     Created: ${r.created_at}`);
      console.log(`     has_issues: ${r.has_issues}`);
      console.log(`     screenshot_url: ${r.screenshot_url ? 'EXISTS' : 'NULL'}`);
    });
  }

  // Check if all 4 properties without screenshots also lack validation_status
  const missingScreenshots = [
    '1d3306c4-0e64-4ca2-b391-0ccfbf64c37e',
    '2a2b06d6-484b-4986-a99e-887afdb35aa1',
    'dcc2ba21-0827-42c2-aecf-eec76edd62b0',
    'ac3f4a2a-8fc2-4c28-9201-de5656ac1eab'
  ];

  console.log('\n=== Correlation Check ===');
  console.log('Properties missing screenshots:');
  missingScreenshots.forEach(propId => {
    const result = results.find(r => r.property_id === propId);
    console.log(`  ${propId}:`);
    console.log(`    validation_status: ${result?.validation_status || 'NULL'}`);
    console.log(`    has_issues: ${result?.has_issues}`);
    console.log(`    screenshot_url: ${result?.screenshot_url ? 'EXISTS' : 'NULL'}`);
  });
}

checkNullStatus();
