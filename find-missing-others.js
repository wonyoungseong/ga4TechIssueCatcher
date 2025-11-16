/**
 * Find missing [OTHERS] properties
 */

import fs from 'fs';
import path from 'path';

const CSV_PATH = './src/ga4Property/Amore_GA4_PropertList.csv';
const RESULTS_DIR = './results/2025-10-30';
const OUTPUT_CSV = './src/ga4Property/Missing_OTHERS.csv';

// Get all OTHERS measurement IDs from CSV
const csvContent = fs.readFileSync(CSV_PATH, 'utf-8');
const csvLines = csvContent.split('\n');

const allOthersIds = new Set();
const csvOthersLines = [];

for (let i = 0; i < csvLines.length; i++) {
  const line = csvLines[i];

  if (line.includes('[OTHERS]') && !line.includes('Test Property')) {
    // Extract measurement ID (4th column)
    const parts = line.split(',');
    const measurementId = parts[3]?.trim();

    if (measurementId && measurementId.startsWith('G-')) {
      allOthersIds.add(measurementId);
      csvOthersLines.push({ measurementId, line });
    }
  }
}

console.log(`Total [OTHERS] in CSV: ${allOthersIds.size}`);

// Get validated OTHERS measurement IDs from result files
const validatedIds = new Set();

if (fs.existsSync(RESULTS_DIR)) {
  const files = fs.readdirSync(RESULTS_DIR)
    .filter(f => f.startsWith('others-') && f.endsWith('.json'));

  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, file), 'utf-8'));
    const measurementId = data.measurementId?.expected || data.measurementId;
    if (measurementId) {
      validatedIds.add(measurementId);
    }
  }
}

console.log(`Validated [OTHERS]: ${validatedIds.size}`);

// Find missing IDs
const missingIds = [...allOthersIds].filter(id => !validatedIds.has(id));
console.log(`Missing [OTHERS]: ${missingIds.length}`);
console.log();

// Create filtered CSV
const header = csvLines[0];
const missingLines = csvOthersLines
  .filter(item => missingIds.includes(item.measurementId))
  .map(item => item.line);

const outputContent = [header, ...missingLines].join('\n');
fs.writeFileSync(OUTPUT_CSV, outputContent, 'utf-8');

console.log(`✅ Created ${OUTPUT_CSV} with ${missingLines.length} properties`);
console.log();
console.log('Missing [OTHERS] properties:');
missingLines.forEach((line, i) => {
  const parts = line.split(',');
  const propertyName = parts[2]?.trim();
  const measurementId = parts[3]?.trim();
  const url = parts[5]?.trim();
  console.log(`${i + 1}. ${propertyName}`);
  console.log(`   ${measurementId} - ${url}`);
});

console.log();
console.log('To validate missing properties only, run:');
console.log('CSV_PATH=./src/ga4Property/Missing_OTHERS.csv npm start');
