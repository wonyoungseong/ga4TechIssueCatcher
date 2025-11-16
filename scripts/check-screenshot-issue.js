/**
 * Check screenshot issue for specific properties
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkScreenshotIssue() {
  const runId = '0486ad47-957c-4c8a-9fd2-b2bbc092e279';

  // Get all results from saved run
  const { data: allResults } = await supabase
    .from('crawl_results')
    .select(`
      id,
      screenshot_path,
      validation_status,
      phase,
      properties(property_name, slug)
    `)
    .eq('crawl_run_id', runId);

  console.log(`\n총 ${allResults.length}개 결과 분석\n`);

  // Group by screenshot_path to find duplicates
  const screenshotGroups = {};
  allResults.forEach(r => {
    const path = r.screenshot_path || 'NULL';
    if (!screenshotGroups[path]) {
      screenshotGroups[path] = [];
    }
    screenshotGroups[path].push(r);
  });

  // Find duplicates
  console.log('중복된 스크린샷 파일:\n');
  let duplicateCount = 0;
  Object.entries(screenshotGroups).forEach(([path, results]) => {
    if (results.length > 1 && path.includes('undefined')) {
      duplicateCount++;
      console.log(`${path.split('/').pop()}: ${results.length}개 프로퍼티가 공유`);
      results.slice(0, 3).forEach(r => {
        console.log(`  - ${r.properties?.property_name}`);
      });
      if (results.length > 3) {
        console.log(`  ... 외 ${results.length - 3}개`);
      }
      console.log('');
    }
  });

  console.log(`총 ${duplicateCount}개의 undefined 스크린샷 파일이 중복 사용됨\n`);

  // Check specific properties mentioned by user
  console.log('사용자가 언급한 프로퍼티들:\n');
  const targetProperties = [
    '[EC] ETUDE - JP',
    '[OTHERS] 디지털방판 모객시스템',
    '[OTHERS] 뷰티스퀘어'
  ];

  targetProperties.forEach(propName => {
    const result = allResults.find(r => r.properties?.property_name === propName);
    if (result) {
      console.log(`${propName}`);
      console.log(`  현재 slug: ${result.properties?.slug}`);
      console.log(`  스크린샷: ${result.screenshot_path}`);
      console.log(`  Phase: ${result.phase}\n`);
    } else {
      console.log(`${propName}: 결과 없음\n`);
    }
  });
}

checkScreenshotIssue()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
