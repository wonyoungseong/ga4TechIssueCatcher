/**
 * CSV Fixer Script
 *
 * Fixes all identified CSV errors:
 * 1. Remove embedded newlines
 * 2. Remove test properties
 * 3. Remove service terminated sites
 * 4. Update wrong Measurement IDs
 * 5. Remove rows with missing required fields
 */

import fs from 'fs';
import path from 'path';

const CSV_PATH = './src/ga4Property/Amore_GA4_PropertList.csv';
const BACKUP_PATH = './src/ga4Property/Amore_GA4_PropertList_backup.csv';
const FIXED_PATH = './src/ga4Property/Amore_GA4_PropertList_fixed.csv';

console.log('\n🔧 CSV Fixer Script\n');

// Backup original
fs.copyFileSync(CSV_PATH, BACKUP_PATH);
console.log(`✅ Backed up original to: ${BACKUP_PATH}`);

// Read original CSV
const content = fs.readFileSync(CSV_PATH, 'utf-8');
const lines = content.split('\n');

console.log(`\n📄 Original CSV: ${lines.length} lines`);

// Properties to remove
const serviceTerminated = [
  '[EC] CUSTOMME - KR',
  '[BR] AMOSPROFESSIONAL',
  '[EC] ETUDE - GL'
];

const testProperties = [
  '[EC] AMOREMALL - TEST',
  '[EC] INNISFREE- TEST',
  '[EC] Test Property',
  '[BR] Test Property',
  '[EC] Test Property - DTC',
  '[OTHERS] Test Property'
];

// Measurement ID corrections
const measurementIdFixes = {
  'G-34V35WFWHH': 'G-PKG8ZN03QW',  // [BR] INNISFREE uses INNISFREE-KR's ID
  'G-HH1FQQPSH5': 'G-825Q30M1ZL',  // [EC] AMOREPACIFIC - US
  'G-KF4SD4WGEC': 'G-PDFTSBWL89',  // [EC] ETUDE - JP
  'G-EBXVMVDCFQ': 'G-XF173Q3CLE',  // [EC] INNISFREE - US
  'G-CP9M4PZYWB': 'G-D3QLV6VJ84',  // [EC] LANEIGE - US
  'G-W7R4FJMLJ6': 'G-L9NFD60EKR',  // [EC] SULWHASOO - US
  'G-BG7SVL2SR3': 'G-HW8EC45GS0'   // [OTHERS] AIBC AI 뷰티톡
};

const fixedLines = [];
let header = true;
let skipped = 0;
let fixed = 0;

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];

  // Keep header
  if (header && i === 0) {
    fixedLines.push(line);
    header = false;
    continue;
  }

  // Skip empty lines
  if (!line.trim()) {
    continue;
  }

  // Parse CSV line
  const columns = line.split(',');

  // Skip if not enough columns
  if (columns.length < 6) {
    console.log(`⚠️  Skipping line ${i + 1}: Not enough columns`);
    skipped++;
    continue;
  }

  const propertyName = columns[2];
  const measurementId = columns[3];
  const url = columns[5];

  // Skip service terminated sites
  if (serviceTerminated.some(name => propertyName.includes(name))) {
    console.log(`🚫 Removing service terminated: ${propertyName}`);
    skipped++;
    continue;
  }

  // Skip test properties
  if (testProperties.some(name => propertyName.includes(name))) {
    console.log(`🧪 Removing test property: ${propertyName}`);
    skipped++;
    continue;
  }

  // Skip rows without URL (except valid properties with multiple URLs)
  if (!url || url === '-' || url.length < 5) {
    // Check if this is a continuation row (empty property name and account name)
    const accountName = columns[1];
    if (!accountName && !propertyName) {
      // This is a continuation row for multiple URLs - keep it
      fixedLines.push(line);
      continue;
    }

    console.log(`⚠️  Skipping line ${i + 1}: Missing URL for ${propertyName || '(unnamed)'}`);
    skipped++;
    continue;
  }

  // Fix measurement IDs
  if (measurementId && measurementIdFixes[measurementId]) {
    const oldId = measurementId;
    const newId = measurementIdFixes[oldId];
    line = line.replace(oldId, newId);
    console.log(`🔧 Fixed Measurement ID: ${propertyName}`);
    console.log(`   ${oldId} → ${newId}`);
    fixed++;
  }

  // Fix embedded newlines in row 3 (INNISFREE dataset ID)
  if (line.includes('analytics_416711867\n')) {
    line = line.replace('analytics_416711867\n', 'analytics_416711867');
    // Skip the next line which is the continuation
    i++;
    console.log(`🔧 Fixed embedded newline in INNISFREE row`);
    fixed++;
  }

  // Fix LANEIGE-TH embedded newline
  if (line.includes('laneige.com,\n')) {
    line = line.replace('laneige.com,\n', 'laneige.com,');
    i++;
    console.log(`🔧 Fixed embedded newline in LANEIGE-TH row`);
    fixed++;
  }

  // Fix MAKEON dataset ID newline
  if (line.includes('analytics_446888740\n')) {
    line = line.replace('analytics_446888740\n', 'analytics_446888740');
    i++;
    console.log(`🔧 Fixed embedded newline in MAKEON row`);
    fixed++;
  }

  // Fix AIBC newline in property name
  if (line.includes('[OTHERS] AIBC AI 뷰티톡\n')) {
    line = line.replace('[OTHERS] AIBC AI 뷰티톡\n', '[OTHERS] AIBC AI 뷰티톡');
    i++;
    console.log(`🔧 Fixed embedded newline in AIBC row`);
    fixed++;
  }

  // Fix Targeting Manager newline
  if (line.includes('[OTHERS] Targeting Manager\n')) {
    line = line.replace('[OTHERS] Targeting Manager\n', '[OTHERS] Targeting Manager');
    i++;
    console.log(`🔧 Fixed embedded newline in Targeting Manager row`);
    fixed++;
  }

  // Fix 뷰티엔젤 newline
  if (line.includes('beautyangel.amorepacific.com,\n')) {
    line = line.replace('beautyangel.amorepacific.com,\n', 'beautyangel.amorepacific.com,');
    i++;
    console.log(`🔧 Fixed embedded newline in 뷰티엔젤 row`);
    fixed++;
  }

  // Fix 라네즈 뷰티테크 newline
  if (line.includes('https://www.laneige-beautycurator.com/bts/lan/\nhttps://')) {
    line = line.replace('https://www.laneige-beautycurator.com/bts/lan/\nhttps://bts.amorepacific.com/bts/lan/', 'https://www.laneige-beautycurator.com/bts/lan/ https://bts.amorepacific.com/bts/lan/');
    console.log(`🔧 Fixed embedded newline in 라네즈 뷰티테크 row`);
    fixed++;
  }

  // Fix Global D2C account name newline
  if (line.includes('[GA4] Amorepacific - Global D2C\n')) {
    line = line.replace('[GA4] Amorepacific - Global D2C\n', '[GA4] Amorepacific - Global D2C');
    i++;
    console.log(`🔧 Fixed embedded newline in Global D2C account name`);
    fixed++;
  }

  fixedLines.push(line);
}

// Write fixed CSV
fs.writeFileSync(FIXED_PATH, fixedLines.join('\n'));

console.log(`\n📊 Summary:`);
console.log(`   Original lines: ${lines.length}`);
console.log(`   Fixed lines: ${fixedLines.length}`);
console.log(`   Skipped: ${skipped}`);
console.log(`   Fixes applied: ${fixed}`);
console.log(`\n✅ Fixed CSV saved to: ${FIXED_PATH}`);
console.log(`📄 Backup saved to: ${BACKUP_PATH}`);
console.log(`\n💡 To use the fixed CSV, run:`);
console.log(`   mv ${FIXED_PATH} ${CSV_PATH}`);
console.log('');
