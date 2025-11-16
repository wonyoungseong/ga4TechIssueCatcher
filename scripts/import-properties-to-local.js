#!/usr/bin/env node

/**
 * Import Properties to Local Supabase Database
 *
 * This script imports property data from CSV file to local Supabase PostgreSQL.
 *
 * Usage:
 *   node scripts/import-properties-to-local.js [csv-file-path]
 *
 * Default CSV: ./src/ga4Property/Amore_GA4_PropertList.csv
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import csv from 'csv-parser';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: '.env.local' });

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:8000';
const SUPABASE_SERVICE_KEY = process.env.SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEFAULT_CSV_PATH = './src/ga4Property/Amore_GA4_PropertList.csv';

// Validate environment variables
if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ Error: SERVICE_KEY or SUPABASE_SERVICE_ROLE_KEY not found in .env.local');
  console.error('Please ensure .env.local file exists and contains the service role key.');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

/**
 * Generate URL-safe slug from property name and URL
 */
function generateSlug(propertyName, url) {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace('www.', '');
    const slug = `${domain.split('.')[0]}-${propertyName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    return slug.substring(0, 255); // Limit to database field length
  } catch (error) {
    return propertyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 255);
  }
}

/**
 * Extract brand from property name or URL
 */
function extractBrand(propertyName, url) {
  // Try to extract from property name (e.g., "[EC] AMOREMALL - KR" -> "AMOREMALL")
  const match = propertyName.match(/\[EC\]\s*([A-Z]+)/);
  if (match) return match[1];

  // Try to extract from URL
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace('www.', '');
    return domain.split('.')[0].toUpperCase();
  } catch (error) {
    return 'UNKNOWN';
  }
}

/**
 * Extract region from property name
 */
function extractRegion(propertyName) {
  const match = propertyName.match(/- ([A-Z]{2})$/);
  return match ? match[1] : null;
}

/**
 * Parse CSV and convert to database format
 */
async function parseCSV(csvFilePath) {
  return new Promise((resolve, reject) => {
    const properties = [];
    let rowCount = 0;

    fs.createReadStream(csvFilePath)
      .pipe(csv())
      .on('data', (row) => {
        rowCount++;

        // Skip header row or empty rows
        if (!row['속성명'] || !row['대표 URLs']) {
          return;
        }

        const propertyName = row['속성명'].trim();
        const url = row['대표 URLs'].trim();
        const measurementId = row['WebStream Measurement ID']?.trim() || null;
        const gtmId = row['Web GTM Pubilic ID']?.trim() || null;

        // Skip if missing essential data
        if (!propertyName || !url) {
          return;
        }

        properties.push({
          property_name: propertyName,
          url: url,
          slug: generateSlug(propertyName, url),
          expected_ga4_id: measurementId,
          expected_gtm_id: gtmId,
          brand: extractBrand(propertyName, url),
          region: extractRegion(propertyName),
          current_status: 'normal',
          is_active: true
        });
      })
      .on('end', () => {
        console.log(`📊 CSV parsing complete. Rows read: ${rowCount}, Valid properties: ${properties.length}`);
        resolve(properties);
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

/**
 * Import properties to database
 */
async function importProperties(properties) {
  console.log(`\n📥 Importing ${properties.length} properties to database...`);

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;
  const errors = [];

  for (const property of properties) {
    try {
      // Try to insert, skip if duplicate (based on unique URL constraint)
      const { data, error } = await supabase
        .from('properties')
        .upsert(property, {
          onConflict: 'url',
          ignoreDuplicates: false
        })
        .select();

      if (error) {
        // Check if it's a duplicate error
        if (error.code === '23505') {
          skipCount++;
        } else {
          errorCount++;
          errors.push({ property: property.property_name, error: error.message });
        }
      } else {
        successCount++;
      }
    } catch (err) {
      errorCount++;
      errors.push({ property: property.property_name, error: err.message });
    }
  }

  return { successCount, skipCount, errorCount, errors };
}

/**
 * Verify imported data
 */
async function verifyImport() {
  console.log('\n🔍 Verifying imported data...');

  const { data: properties, error, count } = await supabase
    .from('properties')
    .select('*', { count: 'exact', head: false });

  if (error) {
    throw new Error(`Verification failed: ${error.message}`);
  }

  const activeCount = properties.filter(p => p.is_active).length;
  const inactiveCount = properties.filter(p => !p.is_active).length;

  console.log(`\n📋 Database Summary:`);
  console.log(`   Total Properties: ${count}`);
  console.log(`   Active: ${activeCount}`);
  console.log(`   Inactive: ${inactiveCount}`);
  console.log(`   Statuses: ${[...new Set(properties.map(p => p.current_status))].join(', ')}`);
  console.log(`   Brands: ${[...new Set(properties.map(p => p.brand))].length} unique brands`);

  return { totalCount: count, activeCount, inactiveCount };
}

/**
 * Main execution
 */
async function main() {
  const csvFilePath = process.argv[2] || DEFAULT_CSV_PATH;

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📦 Properties Import Script');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📂 CSV File: ${csvFilePath}`);
  console.log(`📍 Supabase URL: ${SUPABASE_URL}\n`);

  try {
    // Step 1: Validate CSV file exists
    if (!fs.existsSync(csvFilePath)) {
      throw new Error(`CSV file not found: ${csvFilePath}`);
    }

    // Step 2: Parse CSV
    console.log('1️⃣  Parsing CSV file...');
    const properties = await parseCSV(csvFilePath);

    if (properties.length === 0) {
      throw new Error('No valid properties found in CSV file');
    }

    // Step 3: Import to database
    console.log('2️⃣  Importing to database...');
    const { successCount, skipCount, errorCount, errors } = await importProperties(properties);

    // Step 4: Verify import
    console.log('3️⃣  Verifying import...');
    const { totalCount, activeCount, inactiveCount } = await verifyImport();

    // Step 5: Summary
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Import completed!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`\n📊 Import Results:`);
    console.log(`   Inserted: ${successCount}`);
    console.log(`   Skipped (duplicates): ${skipCount}`);
    console.log(`   Errors: ${errorCount}`);
    console.log(`   Total in Database: ${totalCount}\n`);

    if (errorCount > 0 && errors.length > 0) {
      console.log('⚠️  Errors encountered:');
      errors.slice(0, 5).forEach(err => {
        console.log(`   - ${err.property}: ${err.error}`);
      });
      if (errors.length > 5) {
        console.log(`   ... and ${errors.length - 5} more errors\n`);
      }
    }

    console.log('🎉 You can verify the import in Supabase Studio:');
    console.log(`   http://localhost:3001\n`);

  } catch (error) {
    console.error('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ Import failed');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error(`Error: ${error.message}\n`);
    console.error('Troubleshooting:');
    console.error('1. Ensure Docker services are running: docker-compose ps');
    console.error('2. Verify migrations applied: node scripts/verify-migration.js');
    console.error('3. Check database logs: docker-compose logs db');
    console.error('4. Verify CSV file format and path\n');
    process.exit(1);
  }
}

// Run import
main();
