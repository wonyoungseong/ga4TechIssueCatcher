import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const runId = '8abd66cc-3b05-4608-8265-a53d6d013b56';

  console.log('\n📊 Final Verification - Run ID:', runId);
  console.log('='.repeat(60));

  // Check crawl results with screenshot URLs
  const { data, error } = await supabase
    .from('crawl_results')
    .select('property_id, screenshot_url, created_at')
    .eq('crawl_run_id', runId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.log('❌ Error:', error.message);
    return;
  }

  console.log(`\n✅ Sample Results (showing 10/${data.length}):\n`);
  data.forEach((row, i) => {
    const hasUrl = row.screenshot_url ? '✅' : '❌';
    console.log(`${i+1}. Property: ${row.property_id}`);
    console.log(`   ${hasUrl} Screenshot URL: ${row.screenshot_url || 'NULL'}`);
    console.log(`   Created: ${row.created_at}\n`);
  });

  const withScreenshots = data.filter(r => r.screenshot_url).length;
  const withoutScreenshots = data.filter(r => !r.screenshot_url).length;

  console.log('='.repeat(60));
  console.log(`✅ With screenshot URLs: ${withScreenshots}/10`);
  console.log(`❌ Without screenshot URLs: ${withoutScreenshots}/10`);
  console.log('='.repeat(60));
})();
