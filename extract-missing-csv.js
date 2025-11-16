/**
 * Extract 17 missing properties from CSV to new file
 */

import fs from 'fs';

const CSV_PATH = './src/ga4Property/Amore_GA4_PropertList.csv';
const OUTPUT_PATH = './src/ga4Property/Missing_Properties.csv';

// 17 missing measurement IDs
const MISSING_IDS = [
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

const content = fs.readFileSync(CSV_PATH, 'utf-8');
const lines = content.split('\n');

// Header
const header = lines[0];
const filteredLines = [header];

// Filter data rows
for (let i = 1; i < lines.length; i++) {
  const line = lines[i];

  // Check if line contains any of the missing IDs
  const hasMissingId = MISSING_IDS.some(id => line.includes(id));

  if (hasMissingId) {
    filteredLines.push(line);
  }
}

// Write to new file
fs.writeFileSync(OUTPUT_PATH, filteredLines.join('\n'), 'utf-8');

console.log(`✅ Extracted ${filteredLines.length - 1} missing properties to ${OUTPUT_PATH}`);
console.log('\nTo validate, run:');
console.log('CSV_PATH=./src/ga4Property/Missing_Properties.csv npm start');
