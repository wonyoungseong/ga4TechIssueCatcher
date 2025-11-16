#!/usr/bin/env node

/**
 * Analyze duplicate URLs in CSV
 */

import fs from 'fs/promises';
import { parse } from 'csv-parse/sync';

async function analyzeDuplicates() {
  const csvPath = '/Users/seong-won-yeong/Dev/ga4TechIssueCatcher/data/properties-import.csv';

  // Read CSV file
  const fileContent = await fs.readFile(csvPath, 'utf-8');

  // Parse CSV
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true
  });

  console.log(`\n📊 Total rows in CSV: ${records.length}\n`);

  // Track URLs
  const urlCounts = new Map();
  const urlRecords = new Map();

  for (const record of records) {
    const url = record['대표 URLs']?.trim();

    if (!url) continue;

    if (!urlCounts.has(url)) {
      urlCounts.set(url, 0);
      urlRecords.set(url, []);
    }

    urlCounts.set(url, urlCounts.get(url) + 1);
    urlRecords.get(url).push({
      propertyName: record['속성명'],
      brand: record['계정명'],
      ga4Id: record['Web Stream Measurement ID'],
      gtmId: record['Web GTM Pubilic ID']
    });
  }

  // Find duplicates
  const duplicates = [];
  for (const [url, count] of urlCounts) {
    if (count > 1) {
      duplicates.push({ url, count, records: urlRecords.get(url) });
    }
  }

  console.log(`🔍 Found ${duplicates.length} duplicate URLs:\n`);
  console.log('='.repeat(80));

  for (const { url, count, records } of duplicates) {
    console.log(`\n📍 URL: ${url}`);
    console.log(`   중복 횟수: ${count}회`);
    console.log(`   중복 항목들:`);

    records.forEach((rec, idx) => {
      console.log(`   ${idx + 1}. ${rec.propertyName}`);
      console.log(`      - Brand: ${rec.brand}`);
      console.log(`      - GA4 ID: ${rec.ga4Id}`);
      console.log(`      - GTM ID: ${rec.gtmId}`);
    });
  }

  console.log('\n' + '='.repeat(80));
  console.log(`\n✅ 총 ${duplicates.length}개의 중복 URL`);
  console.log(`   CSV 전체: ${records.length}개 → Unique: ${urlCounts.size}개`);
  console.log(`   중복으로 제거된 항목: ${records.length - urlCounts.size}개\n`);
}

analyzeDuplicates();
