import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const runId = 'b934ba89-edc4-409f-9fea-5b19476f6448';

async function checkValidationResults() {
  console.log('\n=== Checking validation_result Column ===\n');

  // Get all results for this run
  const { data: results, error } = await supabase
    .from('crawl_results')
    .select('property_id, validation_result, created_at')
    .eq('crawl_run_id', runId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error:', error);
    return;
  }

  // Check if validation_result exists
  const withValidation = results.filter(r => r.validation_result !== null);
  const withoutValidation = results.filter(r => r.validation_result === null);

  console.log(`Total results: ${results.length}`);
  console.log(`With validation_result: ${withValidation.length}`);
  console.log(`Without validation_result: ${withoutValidation.length}`);

  if (withoutValidation.length > 0) {
    console.log('\n❌ Properties WITHOUT validation_result:');
    withoutValidation.forEach((r, idx) => {
      console.log(`  ${idx + 1}. ${r.property_id}`);
      console.log(`     Created: ${r.created_at}`);
    });
  }

  // Check if all 4 properties without screenshots also lack validation_result
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
    const hasValidation = result?.validation_result !== null;
    console.log(`  ${propId}: validation_result = ${hasValidation ? 'EXISTS' : 'NULL'}`);
  });
}

checkValidationResults();
