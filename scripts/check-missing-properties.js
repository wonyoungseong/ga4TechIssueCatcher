/**
 * Check if all properties are included in crawl results
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkMissingProperties() {
  // Get total active properties
  const { count: totalProps } = await supabase
    .from('properties')
    .select('id', { count: 'exact' })
    .eq('is_active', true);

  console.log(`\n총 활성 프로퍼티: ${totalProps}개\n`);

  // Get latest saved run
  const { data: runs } = await supabase
    .from('crawl_runs')
    .select('id, created_at, total_properties')
    .eq('is_saved', true)
    .order('saved_at', { ascending: false })
    .limit(1);

  if (!runs || runs.length === 0) {
    console.log('저장된 크롤링 결과가 없습니다.');
    return;
  }

  const runId = runs[0].id;
  console.log(`저장된 크롤링 결과:`);
  console.log(`  Run ID: ${runId}`);
  console.log(`  실행 시간: ${runs[0].created_at}`);
  console.log(`  총 프로퍼티 (기록): ${runs[0].total_properties}개\n`);

  // Count results in this run
  const { count: resultsCount } = await supabase
    .from('crawl_results')
    .select('id', { count: 'exact' })
    .eq('crawl_run_id', runId);

  console.log(`실제 결과 개수: ${resultsCount}개`);
  console.log(`누락된 개수: ${totalProps - resultsCount}개\n`);

  if (resultsCount < totalProps) {
    // Find which properties are missing
    const { data: allProperties } = await supabase
      .from('properties')
      .select('id, property_name')
      .eq('is_active', true);

    const { data: resultsProperties } = await supabase
      .from('crawl_results')
      .select('property_id')
      .eq('crawl_run_id', runId);

    const resultPropertyIds = new Set(resultsProperties.map(r => r.property_id));
    const missingProperties = allProperties.filter(p => !resultPropertyIds.has(p.id));

    console.log(`누락된 프로퍼티 목록 (${missingProperties.length}개):\n`);
    missingProperties.forEach((p, i) => {
      console.log(`${i + 1}. ${p.property_name}`);
    });
  } else {
    console.log('✅ 모든 프로퍼티가 결과에 포함되어 있습니다!');
  }
}

checkMissingProperties()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
