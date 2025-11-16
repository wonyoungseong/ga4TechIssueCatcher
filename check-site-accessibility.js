/**
 * Site Accessibility Checker
 *
 * 실패한 사이트들이 실제로 접근 가능한지 확인
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RESULTS_DIR = path.join(__dirname, 'results/2025-10-30');
const TIMEOUT_MS = 10000; // 10초 타임아웃

/**
 * HTTP 요청으로 사이트 접근성 체크
 */
async function checkSiteAccessibility(url, propertyName) {
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(url, {
      method: 'HEAD', // HEAD 요청으로 빠르게 체크
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      },
      redirect: 'follow' // 리다이렉트 따라가기
    });

    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;

    return {
      propertyName,
      url,
      accessible: true,
      statusCode: response.status,
      statusText: response.statusText,
      finalUrl: response.url, // 리다이렉트된 최종 URL
      responseTimeMs: responseTime,
      redirected: response.url !== url
    };

  } catch (error) {
    const responseTime = Date.now() - startTime;

    return {
      propertyName,
      url,
      accessible: false,
      error: error.name,
      errorMessage: error.message,
      responseTimeMs: responseTime,
      isTimeout: error.name === 'AbortError',
      isNetworkError: error.name === 'TypeError'
    };
  }
}

/**
 * 검증 결과 파일에서 실패한 사이트 추출
 */
function getFailedSites() {
  const summaryPath = path.join(RESULTS_DIR, '_summary.json');
  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));

  const failedSites = [];

  // 모든 결과 파일 읽기
  const files = fs.readdirSync(RESULTS_DIR)
    .filter(f => f.endsWith('.json') && f !== '_summary.json');

  for (const file of files) {
    const filePath = path.join(RESULTS_DIR, file);
    const result = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    // 실패한 사이트만 추출
    if (!result.isValid) {
      failedSites.push({
        propertyName: result.propertyName,
        url: result.url,
        issues: result.issues.map(i => i.type)
      });
    }
  }

  return failedSites;
}

/**
 * 메인 실행
 */
async function main() {
  console.log('🔍 사이트 접근성 테스트 시작...\n');
  console.log('============================================================');

  const failedSites = getFailedSites();
  console.log(`📊 검증 실패 사이트: ${failedSites.length}개\n`);

  const results = [];
  let accessibleCount = 0;
  let inaccessibleCount = 0;
  let redirectedCount = 0;
  let timeoutCount = 0;

  // 병렬 처리 (5개씩)
  const BATCH_SIZE = 5;
  for (let i = 0; i < failedSites.length; i += BATCH_SIZE) {
    const batch = failedSites.slice(i, i + BATCH_SIZE);
    console.log(`\n📦 배치 ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length}개 사이트)...\n`);

    const batchResults = await Promise.all(
      batch.map(site => checkSiteAccessibility(site.url, site.propertyName))
    );

    // 결과 출력
    for (const result of batchResults) {
      results.push(result);

      if (result.accessible) {
        accessibleCount++;
        if (result.redirected) {
          redirectedCount++;
          console.log(`✅ ${result.propertyName}`);
          console.log(`   URL: ${result.url}`);
          console.log(`   상태: ${result.statusCode} ${result.statusText}`);
          console.log(`   🔄 리다이렉트: ${result.finalUrl}`);
          console.log(`   응답 시간: ${result.responseTimeMs}ms\n`);
        } else {
          console.log(`✅ ${result.propertyName}`);
          console.log(`   URL: ${result.url}`);
          console.log(`   상태: ${result.statusCode} ${result.statusText}`);
          console.log(`   응답 시간: ${result.responseTimeMs}ms\n`);
        }
      } else {
        inaccessibleCount++;
        if (result.isTimeout) {
          timeoutCount++;
          console.log(`⏱️ ${result.propertyName}`);
          console.log(`   URL: ${result.url}`);
          console.log(`   오류: 타임아웃 (${TIMEOUT_MS}ms 초과)\n`);
        } else {
          console.log(`❌ ${result.propertyName}`);
          console.log(`   URL: ${result.url}`);
          console.log(`   오류: ${result.error} - ${result.errorMessage}\n`);
        }
      }
    }
  }

  // 최종 요약
  console.log('\n============================================================');
  console.log('📊 사이트 접근성 테스트 결과\n');
  console.log(`총 실패 사이트: ${failedSites.length}개`);
  console.log(`✅ 접근 가능: ${accessibleCount}개 (${(accessibleCount / failedSites.length * 100).toFixed(1)}%)`);
  console.log(`❌ 접근 불가: ${inaccessibleCount}개 (${(inaccessibleCount / failedSites.length * 100).toFixed(1)}%)`);
  console.log(`🔄 리다이렉트: ${redirectedCount}개 (${(redirectedCount / failedSites.length * 100).toFixed(1)}%)`);
  console.log(`⏱️ 타임아웃: ${timeoutCount}개 (${(timeoutCount / failedSites.length * 100).toFixed(1)}%)`);
  console.log('============================================================\n');

  // 상세 분류
  const accessible = results.filter(r => r.accessible);
  const inaccessible = results.filter(r => !r.accessible);
  const redirected = results.filter(r => r.accessible && r.redirected);
  const timeouts = results.filter(r => !r.accessible && r.isTimeout);

  // 접근 불가 사이트 상세
  if (inaccessible.length > 0) {
    console.log('\n❌ 접근 불가 사이트 상세:\n');
    for (const site of inaccessible) {
      console.log(`- ${site.propertyName}`);
      console.log(`  URL: ${site.url}`);
      console.log(`  오류: ${site.error} - ${site.errorMessage}\n`);
    }
  }

  // 리다이렉트 사이트 상세
  if (redirected.length > 0) {
    console.log('\n🔄 리다이렉트 사이트 상세:\n');
    for (const site of redirected) {
      console.log(`- ${site.propertyName}`);
      console.log(`  원본: ${site.url}`);
      console.log(`  최종: ${site.finalUrl}\n`);
    }
  }

  // 결과 저장
  const outputPath = '/tmp/site_accessibility_report.json';
  fs.writeFileSync(outputPath, JSON.stringify({
    summary: {
      totalSites: failedSites.length,
      accessible: accessibleCount,
      inaccessible: inaccessibleCount,
      redirected: redirectedCount,
      timeout: timeoutCount
    },
    details: results
  }, null, 2));

  console.log(`\n💾 상세 리포트 저장: ${outputPath}`);
}

main().catch(console.error);
