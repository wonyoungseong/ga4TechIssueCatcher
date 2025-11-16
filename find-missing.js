/**
 * 누락된 사이트 찾기
 */

import fs from 'fs';
import path from 'path';
import csvParser from 'csv-parser';
import { createReadStream } from 'fs';

const CSV_PATH = './src/ga4Property/Amore_GA4_PropertList.csv';
const RESULTS_DIR = './results/2025-10-30';

// CSV에서 모든 프로퍼티 로드
async function loadPropertiesFromCSV() {
  const properties = [];

  return new Promise((resolve) => {
    createReadStream(CSV_PATH)
      .pipe(csvParser())
      .on('data', (row) => {
        // 필수 필드 확인
        if (row.measurementId && row.measurementId.trim() !== '' &&
            row.representativeUrl && row.representativeUrl.trim() !== '') {
          properties.push({
            name: row.propertyName,
            slug: row.slug,
            measurementId: row.measurementId,
            url: row.representativeUrl
          });
        }
      })
      .on('end', () => {
        resolve(properties);
      });
  });
}

// 결과 파일에서 검증된 프로퍼티 로드
function loadValidatedProperties() {
  const files = fs.readdirSync(RESULTS_DIR)
    .filter(f => f.endsWith('.json') && f !== '_summary.json');

  const validated = [];
  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, file), 'utf-8'));
    validated.push({
      name: data.propertyName,
      slug: data.slug,
      file
    });
  }

  return validated;
}

async function main() {
  console.log('누락된 사이트 분석 중...\n');

  const csvProperties = await loadPropertiesFromCSV();
  const validatedProperties = loadValidatedProperties();

  console.log('='.repeat(60));
  console.log(`CSV 프로퍼티: ${csvProperties.length}개`);
  console.log(`검증 완료: ${validatedProperties.length}개`);
  console.log(`누락: ${csvProperties.length - validatedProperties.length}개`);
  console.log('='.repeat(60));
  console.log();

  // 검증된 slug 목록
  const validatedSlugs = new Set(validatedProperties.map(p => p.slug));

  // 누락된 프로퍼티 찾기
  const missing = csvProperties.filter(p => !validatedSlugs.has(p.slug));

  console.log(`❌ 누락된 사이트 (${missing.length}개):\n`);
  console.log('-'.repeat(60));

  missing.forEach((p, i) => {
    console.log(`${i + 1}. ${p.name}`);
    console.log(`   Slug: ${p.slug}`);
    console.log(`   URL: ${p.url}`);
    console.log(`   Measurement ID: ${p.measurementId}`);
    console.log();
  });

  console.log('='.repeat(60));
  console.log('분석 완료');
  console.log('='.repeat(60));
}

main().catch(console.error);
