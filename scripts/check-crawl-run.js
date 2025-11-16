import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const runId = 'b934ba89-edc4-409f-9fea-5b19476f6448';

async function checkCrawlRun() {
  console.log(`\n=== Checking Crawl Run: ${runId} ===\n`);

  // 1. Check crawl_runs table
  const { data: runData, error: runError } = await supabase
    .from('crawl_runs')
    .select('*')
    .eq('id', runId)
    .single();

  if (runError) {
    console.error('Error fetching crawl_runs:', runError);
    return;
  }

  console.log('Crawl Run Info:');
  console.log(`  Status: ${runData.status}`);
  console.log(`  Total Properties: ${runData.total_properties}`);
  console.log(`  Completed: ${runData.completed_count}`);
  console.log(`  Failed: ${runData.failed_count}`);
  console.log(`  Started: ${runData.started_at}`);
  console.log(`  Completed: ${runData.completed_at}`);

  // 2. Count actual results in crawl_results
  const { data: results, error: resultsError } = await supabase
    .from('crawl_results')
    .select('property_id, screenshot_url, created_at')
    .eq('crawl_run_id', runId);

  if (resultsError) {
    console.error('Error fetching crawl_results:', resultsError);
    return;
  }

  console.log(`\nActual Results Count: ${results.length}`);
  console.log(`Expected Count: ${runData.total_properties}`);
  const discrepancy = results.length - runData.total_properties;
  console.log(`Discrepancy: ${discrepancy}`);

  // 3. Check screenshot URLs
  const withScreenshots = results.filter(r => r.screenshot_url);
  const withoutScreenshots = results.filter(r => !r.screenshot_url);

  console.log(`\nScreenshot Status:`);
  console.log(`  With screenshots: ${withScreenshots.length}`);
  console.log(`  Without screenshots: ${withoutScreenshots.length}`);

  if (withoutScreenshots.length > 0) {
    console.log(`\n❌ Properties without screenshots (first 10):`);
    withoutScreenshots.slice(0, 10).forEach((r, idx) => {
      console.log(`  ${idx + 1}. ${r.property_id} (${r.created_at})`);
    });
  }

  // 4. Check for duplicate property_ids
  const propertyIds = results.map(r => r.property_id);
  const duplicates = propertyIds.filter((id, index) => propertyIds.indexOf(id) !== index);

  if (duplicates.length > 0) {
    console.log(`\n⚠️  Duplicate property_ids found: ${duplicates.length}`);
    const uniqueDuplicates = [...new Set(duplicates)];
    console.log(`  Unique duplicated properties: ${uniqueDuplicates.length}`);
    uniqueDuplicates.slice(0, 5).forEach((id, idx) => {
      const count = propertyIds.filter(pid => pid === id).length;
      console.log(`  ${idx + 1}. ${id} (appears ${count} times)`);
    });
  }

  // 5. Check properties table for total count
  const { data: properties, error: propsError } = await supabase
    .from('properties')
    .select('property_id, property_name, is_active');

  if (!propsError) {
    const activeProps = properties.filter(p => p.is_active !== false);
    console.log(`\nProperties Table:`);
    console.log(`  Total properties: ${properties.length}`);
    console.log(`  Active properties: ${activeProps.length}`);
  }
}

checkCrawlRun();
