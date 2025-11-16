/**
 * Create clean CSV with missing OTHERS properties (exclude no-URL entries)
 */

import fs from 'fs';
import path from 'path';

const CSV_PATH = './src/ga4Property/Amore_GA4_PropertList.csv';
const RESULTS_DIR = './results/2025-10-30';
const OUTPUT_CSV = './src/ga4Property/Missing_OTHERS.csv';

// Get validated OTHERS measurement IDs
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

// Parse CSV and filter
const csvContent = fs.readFileSync(CSV_PATH, 'utf-8');
const lines = csvContent.split('\n');

const header = lines[0];
const filteredLines = [];

for (let i = 1; i < lines.length; i++) {
  const line = lines[i];

  // Check if it's an OTHERS property
  if (!line.includes('[OTHERS]') || line.includes('Test Property')) {
    continue;
  }

  const parts = line.split(',');
  const measurementId = parts[3]?.trim();
  const url = parts[5]?.trim();

  // Skip if already validated
  if (validatedIds.has(measurementId)) {
    continue;
  }

  // Skip if no URL (will be filtered anyway)
  if (!url || url === '-' || url === '""' || url.length < 5) {
    console.log(`Skipping (no URL): ${parts[2]?.trim()}`);
    continue;
  }

  filteredLines.push(line);
}

// Create output
const outputContent = [header, ...filteredLines].join('\n');
fs.writeFileSync(OUTPUT_CSV, outputContent, 'utf-8');

console.log();
console.log(`✅ Created ${OUTPUT_CSV} with ${filteredLines.length} properties`);
console.log();

// Display list
filteredLines.forEach((line, i) => {
  const parts = line.split(',');
  const propertyName = parts[2]?.trim();
  const measurementId = parts[3]?.trim();
  const url = parts[5]?.trim();
  console.log(`${i + 1}. ${propertyName}`);
  console.log(`   ${measurementId} - ${url}`);
});

console.log();
console.log('To validate, run:');
console.log('CSV_PATH=./src/ga4Property/Missing_OTHERS.csv npm start');
