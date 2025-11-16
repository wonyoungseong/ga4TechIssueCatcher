/**
 * Re-validate the 17 missing properties with increased timeout
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateProperty } from './src/modules/orchestrator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 17 missing measurement IDs identified from previous analysis
const MISSING_MEASUREMENT_IDS = [
  'G-HCNZZ51XJL', // [OTHERS] 옴니회원플랫폼
  'G-W5HWQHPQYX', // [OTHERS] 퍼시픽패키지
  'G-5BZ05M29VM', // [OTHERS] 아모레퍼시픽 공식 대시보드
  'G-YK4HFVFJBD', // [OTHERS] 데이터플레이스
  'G-F13XF12ZBM', // [OTHERS] Targeting Manager
  'G-EF0YKTXZ15', // [OTHERS] AMOSPRO BO
  'G-6J1J3YH5BC', // [OTHERS] 아모레팩토리 오디오 가이드
  'G-6HFYMRWV53', // [OTHERS] 아모레퍼시픽 미술관
  'G-C5PNSPZ9HT', // [OTHERS] 아모레스토리
  'G-L5GJLCGNGP', // [OTHERS] 아모레 카운셀러
  'G-FNBRQFBFYQ', // [OTHERS] 디지털방판 모객시스템
  'G-47NVWLNDTL', // [OTHERS] 뷰티스퀘어
  'G-FQJZ6PPPNV', // [OTHERS] 라네즈 뷰티테크
  'G-E6ZQGX19LW', // [OTHERS] 쉐이드피커
  'G-ECMNKRWKH7', // [OTHERS] 시티랩
  'G-41E1RXLZT0', // [OTHERS] 에스트라
  'G-HY0K4M4CYP', // [OTHERS] 북촌뷰티과학자의집
  'G-WTT2PZ2Y5X'  // [OTHERS] AIBC AI 뷰티톡
];

// Load CSV and filter for missing properties
function loadMissingProperties() {
  const csvPath = path.join(__dirname, 'src/ga4Property/Amore_GA4_PropertList.csv');
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n');

  const properties = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(',');
    const accountName = parts[1]?.trim();
    const propertyName = parts[2]?.trim();
    const measurementId = parts[3]?.trim();
    const gtmContainerId = parts[4]?.trim();
    const url = parts[5]?.trim();

    // Only include properties with measurement IDs in our missing list
    if (MISSING_MEASUREMENT_IDS.includes(measurementId)) {
      properties.push({
        accountName,
        propertyName,
        measurementId,
        gtmContainerId: gtmContainerId === '-' ? null : gtmContainerId,
        representativeUrl: url
      });
    }
  }

  return properties;
}

// Save result to separate folder
async function saveRevalidationResult(result, dateStr) {
  const resultFolder = `results/${dateStr}-revalidation`;
  await fs.promises.mkdir(resultFolder, { recursive: true });

  const filename = `${result.slug}.json`;
  const filePath = `${resultFolder}/${filename}`;

  const jsonContent = JSON.stringify(result, null, 2);
  await fs.promises.writeFile(filePath, jsonContent, 'utf-8');

  console.log(`  💾 Result saved: ${filePath}`);
  return filePath;
}

// Main execution
async function main() {
  const startTime = Date.now();
  const dateStr = new Date().toISOString().split('T')[0];

  console.log('='.repeat(60));
  console.log('🔄 Re-validating 17 Missing Properties');
  console.log(`📅 Date: ${dateStr}`);
  console.log(`⏱️  Timeout: 30 seconds (increased from 15s)`);
  console.log('='.repeat(60));
  console.log();

  const properties = loadMissingProperties();

  console.log(`📊 Loaded ${properties.length} missing properties`);
  console.log();

  const results = {
    success: [],
    failed: [],
    errors: []
  };

  // Validate each property
  for (let i = 0; i < properties.length; i++) {
    const property = properties[i];
    console.log(`\n[${ i + 1}/${properties.length}] ${property.propertyName}`);
    console.log(`  URL: ${property.representativeUrl}`);
    console.log(`  Measurement ID: ${property.measurementId}`);

    try {
      const result = await validateProperty(property);

      // Save result
      await saveRevalidationResult(result, dateStr);

      if (result.isValid) {
        results.success.push(property.propertyName);
        console.log(`  ✅ VALID`);
      } else {
        results.failed.push({
          name: property.propertyName,
          issues: result.issues?.map(i => i.type) || []
        });
        console.log(`  ❌ INVALID: ${result.issues?.map(i => i.type).join(', ')}`);
      }

    } catch (error) {
      results.errors.push({
        name: property.propertyName,
        error: error.message
      });
      console.log(`  💥 ERROR: ${error.message}`);
    }
  }

  // Summary
  const executionTime = Date.now() - startTime;

  console.log('\n' + '='.repeat(60));
  console.log('📊 Re-validation Summary');
  console.log('='.repeat(60));
  console.log(`Total Properties: ${properties.length}`);
  console.log(`✅ Success: ${results.success.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  console.log(`💥 Errors: ${results.errors.length}`);
  console.log(`⏱️  Execution Time: ${(executionTime / 1000).toFixed(1)}s`);
  console.log('='.repeat(60));

  if (results.success.length > 0) {
    console.log('\n✅ Successfully Validated:');
    results.success.forEach((name, i) => console.log(`  ${i + 1}. ${name}`));
  }

  if (results.failed.length > 0) {
    console.log('\n❌ Still Failed:');
    results.failed.forEach(({ name, issues }, i) => {
      console.log(`  ${i + 1}. ${name}`);
      console.log(`     Issues: ${issues.join(', ')}`);
    });
  }

  if (results.errors.length > 0) {
    console.log('\n💥 Errors:');
    results.errors.forEach(({ name, error }, i) => {
      console.log(`  ${i + 1}. ${name}`);
      console.log(`     Error: ${error}`);
    });
  }

  console.log('\n📁 Results saved to: results/' + dateStr + '-revalidation/');
}

// Run
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
