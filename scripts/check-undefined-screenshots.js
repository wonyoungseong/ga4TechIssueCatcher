/**
 * Check which properties had undefined screenshots
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkUndefinedScreenshots() {
  // Get latest saved run
  const { data: runs } = await supabase
    .from('crawl_runs')
    .select('id, created_at, saved_at')
    .eq('is_saved', true)
    .order('saved_at', { ascending: false })
    .limit(1);

  if (!runs || runs.length === 0) {
    console.log('저장된 결과가 없습니다.');
    return;
  }

  const runId = runs[0].id;
  console.log(`\n저장된 크롤링 결과 분석:`);
  console.log(`  ID: ${runId}`);
  console.log(`  실행 시간: ${runs[0].created_at}`);
  console.log(`  저장 시간: ${runs[0].saved_at}\n`);

  // Get results with undefined screenshots
  const { data: results } = await supabase
    .from('crawl_results')
    .select(`
      id,
      screenshot_path,
      property_id,
      properties(property_name, slug)
    `)
    .eq('crawl_run_id', runId)
    .like('screenshot_path', '%undefined%');

  console.log(`undefined 스크린샷을 가진 프로퍼티 (총 ${results.length}개):\n`);

  results.slice(0, 40).forEach((r, i) => {
    console.log(`${(i+1).toString().padStart(2)}. ${r.properties?.property_name}`);
    console.log(`    현재 slug: ${r.properties?.slug}`);
    console.log(`    파일: ${r.screenshot_path.split('/').pop()}\n`);
  });
}

checkUndefinedScreenshots()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
