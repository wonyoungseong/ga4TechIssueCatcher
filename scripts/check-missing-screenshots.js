import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const runId = 'b934ba89-edc4-409f-9fea-5b19476f6448';

// The 4 properties without screenshots
const missingProperties = [
  '1d3306c4-0e64-4ca2-b391-0ccfbf64c37e',
  '2a2b06d6-484b-4986-a99e-887afdb35aa1',
  'dcc2ba21-0827-42c2-aecf-eec76edd62b0',
  'ac3f4a2a-8fc2-4c28-9201-de5656ac1eab'
];

async function checkMissingScreenshots() {
  console.log('\n=== Investigating Missing Screenshots ===\n');

  for (const propertyId of missingProperties) {
    console.log(`\n--- Property: ${propertyId} ---`);

    // Get detailed information from crawl_results
    const { data: result, error } = await supabase
      .from('crawl_results')
      .select('*')
      .eq('property_id', propertyId)
      .eq('crawl_run_id', runId)
      .single();

    if (error) {
      console.error(`Error fetching result:`, error.message);
      continue;
    }

    console.log(`Created at: ${result.created_at}`);
    console.log(`Screenshot URL: ${result.screenshot_url || 'NULL'}`);
    console.log(`Permanent URL: ${result.permanent_screenshot_url || 'NULL'}`);

    // Check validation result
    if (result.validation_result) {
      const vr = result.validation_result;
      console.log(`\nValidation Result:`);
      console.log(`  Is Valid: ${vr.isValid}`);
      console.log(`  Phase: ${vr.phase || 'N/A'}`);
      console.log(`  Execution Time: ${vr.executionTimeMs || 'N/A'}ms`);

      if (vr.issues && vr.issues.length > 0) {
        console.log(`  Issues: ${vr.issues.length}`);
        vr.issues.forEach((issue, idx) => {
          console.log(`    ${idx + 1}. ${issue}`);
        });
      } else {
        console.log(`  Issues: None`);
      }
    } else {
      console.log(`\nValidation Result: NULL`);
    }

    // Check if error occurred
    if (result.error_message) {
      console.log(`\nError Message: ${result.error_message}`);
    }
  }

  // Check if there are any screenshots in Storage for these properties
  console.log('\n\n=== Checking Supabase Storage ===\n');

  const { data: files, error: listError } = await supabase
    .storage
    .from('screenshots')
    .list(runId, {
      limit: 1000
    });

  if (listError) {
    console.error('Error listing files:', listError.message);
    return;
  }

  console.log(`Total files in run folder: ${files.length}`);

  // Check if any of the missing properties have files
  const foundFiles = missingProperties.map(propId => {
    const found = files.filter(f => f.name.includes(propId));
    return {
      propertyId: propId,
      filesFound: found.length,
      files: found.map(f => f.name)
    };
  });

  console.log('\nFiles found in Storage:');
  foundFiles.forEach(item => {
    console.log(`\n${item.propertyId}:`);
    if (item.filesFound > 0) {
      console.log(`  ✅ ${item.filesFound} file(s) found:`);
      item.files.forEach(f => console.log(`    - ${f}`));
    } else {
      console.log(`  ❌ No files found`);
    }
  });
}

checkMissingScreenshots();
