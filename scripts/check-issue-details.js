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

async function checkIssueDetails() {
  console.log('\n=== Issue Details for Properties Without Screenshots ===\n');

  for (const propertyId of missingProperties) {
    console.log(`\n--- Property: ${propertyId} ---`);

    // Get detailed information
    const { data: result, error } = await supabase
      .from('crawl_results')
      .select('*, properties(property_name)')
      .eq('property_id', propertyId)
      .eq('crawl_run_id', runId)
      .single();

    if (error) {
      console.error(`Error fetching result:`, error.message);
      continue;
    }

    console.log(`Property Name: ${result.properties?.property_name || 'N/A'}`);
    console.log(`Created at: ${result.created_at}`);
    console.log(`Validation Status: ${result.validation_status}`);
    console.log(`Has Issues: ${result.has_issues}`);
    console.log(`Phase: ${result.phase || 'N/A'}`);
    console.log(`Validation Duration: ${result.validation_duration_ms || 'N/A'}ms`);

    console.log(`\nIssue Types:`);
    if (result.issue_types && result.issue_types.length > 0) {
      result.issue_types.forEach((type, idx) => {
        console.log(`  ${idx + 1}. ${type}`);
      });
    } else {
      console.log(`  (none)`);
    }

    console.log(`\nIssue Summary:`);
    console.log(`  ${result.issue_summary || '(no summary)'}`);

    console.log(`\nCollected Data:`);
    console.log(`  GA4 ID: ${result.collected_ga4_id || 'N/A'}`);
    console.log(`  GTM ID: ${result.collected_gtm_id || 'N/A'}`);
    console.log(`  Page View Event: ${result.page_view_event_detected}`);

    console.log(`\nScreenshot:`);
    console.log(`  Path: ${result.screenshot_path || 'N/A'}`);
    console.log(`  URL: ${result.screenshot_url || 'N/A'}`);
  }

  // Compare with successful properties
  console.log('\n\n=== Comparison with Successful Properties ===\n');

  const { data: successResults, error: successError } = await supabase
    .from('crawl_results')
    .select('validation_status, has_issues, screenshot_url, phase')
    .eq('crawl_run_id', runId)
    .not('screenshot_url', 'is', null)
    .limit(3);

  if (!successError && successResults) {
    console.log('Sample of properties WITH screenshots:');
    successResults.forEach((r, idx) => {
      console.log(`  ${idx + 1}. Status: ${r.validation_status}, Issues: ${r.has_issues}, Phase: ${r.phase}`);
    });
  }
}

checkIssueDetails();
