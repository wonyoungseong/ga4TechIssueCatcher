/**
 * Summary 분석 스크립트
 */

import fs from 'fs';
import path from 'path';

const RESULTS_DIR = './results/2025-10-30';

// Summary 읽기
const summary = JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, '_summary.json'), 'utf-8'));

console.log('='.repeat(60));
console.log('Summary 분석');
console.log('='.repeat(60));
console.log();

console.log(`총 프로퍼티: ${summary.totalProperties}`);
console.log(`성공: ${summary.successfulValidations}`);
console.log(`실패: ${summary.failedValidations}`);
console.log(`에러: ${summary.errorCount}`);
console.log();

// 실제 파일 개수 확인
const files = fs.readdirSync(RESULTS_DIR)
  .filter(f => f.endsWith('.json') && f !== '_summary.json');

console.log(`실제 JSON 파일 개수: ${files.length}`);
console.log(`차이: ${summary.totalProperties - files.length}`);
console.log();

// 모든 파일 읽어서 프로퍼티 이름 수집
const properties = [];
for (const file of files) {
  const data = JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, file), 'utf-8'));
  properties.push({
    name: data.propertyName,
    slug: data.slug,
    isValid: data.isValid,
    file
  });
}

console.log('='.repeat(60));
console.log('검증 결과');
console.log('='.repeat(60));
console.log();

const successful = properties.filter(p => p.isValid);
const failed = properties.filter(p => !p.isValid);

console.log(`✅ 성공: ${successful.length}개`);
console.log(`❌ 실패: ${failed.length}개`);
console.log();

// 실패한 사이트 목록
console.log('실패한 사이트 목록:');
console.log('-'.repeat(60));
failed.forEach((p, i) => {
  console.log(`${i + 1}. ${p.name} (${p.slug})`);
});

console.log('\n' + '='.repeat(60));
console.log(`검증: summary(${summary.totalProperties}) vs 파일(${files.length}) = 차이 ${summary.totalProperties - files.length}`);
console.log('='.repeat(60));
