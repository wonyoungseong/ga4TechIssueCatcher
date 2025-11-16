#!/usr/bin/env node

/**
 * Update Properties from Numbers File
 *
 * 1. Delete all existing properties from Supabase
 * 2. Import new properties from converted CSV file
 */

import 'dotenv/config';
import { supabase, Tables, PropertyStatus } from '../src/utils/supabase.js';
import fs from 'fs/promises';
import { parse } from 'csv-parse/sync';
import crypto from 'crypto';

/**
 * Generate URL-safe slug from property name or URL
 * Ensures uniqueness by using MD5 hash of full URL
 */
function generateSlug(name, url) {
  try {
    // Create hash of full URL for uniqueness
    const hash = crypto.createHash('md5').update(url).digest('hex').substring(0, 8);

    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    const domain = urlObj.hostname.replace(/^www\./, '');
    const path = urlObj.pathname.replace(/\/$/, '').replace(/^\//, '');

    // Build slug with domain, path, and hash
    let slug = domain;
    if (path && path !== '') {
      slug += '-' + path.replace(/\//g, '-');
    }
    slug += '-' + hash;

    return slug.replace(/[^a-z0-9-]/gi, '-').toLowerCase().substring(0, 100);
  } catch (err) {
    // Fallback: use URL hash only
    const hash = crypto.createHash('md5').update(url).digest('hex').substring(0, 16);
    return hash;
  }
}

/**
 * Delete all properties from database
 */
async function deleteAllProperties() {
  console.log('\n🗑️  Deleting all existing properties...');

  const { error } = await supabase
    .from(Tables.PROPERTIES)
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all (dummy condition)

  if (error) {
    throw new Error(`Failed to delete properties: ${error.message}`);
  }

  console.log('✅ All properties deleted\n');
}

/**
 * Import properties from CSV
 */
async function importPropertiesFromCSV(csvPath) {
  console.log(`📄 Loading properties from: ${csvPath}\n`);

  // Read CSV file
  const fileContent = await fs.readFile(csvPath, 'utf-8');

  // Parse CSV
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true
  });

  console.log(`📊 Found ${records.length} rows in CSV\n`);

  // Transform records to properties
  const properties = [];
  const seenUrls = new Set();

  for (const record of records) {
    const url = record['대표 URLs']?.trim();
    const propertyName = record['속성명']?.trim();
    const measurementId = record['Web Stream Measurement ID']?.trim();
    const gtmId = record['Web GTM Pubilic ID']?.trim();
    const brand = record['계정명']?.trim();

    // Skip if missing required fields
    if (!url || !propertyName) {
      continue;
    }

    // Skip duplicates (same URL)
    if (seenUrls.has(url)) {
      continue;
    }
    seenUrls.add(url);

    const slug = generateSlug(propertyName, url);

    properties.push({
      property_name: propertyName,
      url: url,
      slug: slug,
      expected_ga4_id: measurementId || null,
      expected_gtm_id: gtmId || null,
      current_status: PropertyStatus.NORMAL,
      brand: brand || null,
      region: null,
      is_active: true
    });
  }

  console.log(`✅ Processed ${properties.length} unique properties\n`);

  // Insert properties in batches
  const batchSize = 100;
  let inserted = 0;

  for (let i = 0; i < properties.length; i += batchSize) {
    const batch = properties.slice(i, i + batchSize);

    console.log(`📥 Inserting batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(properties.length / batchSize)}...`);

    const { data, error } = await supabase
      .from(Tables.PROPERTIES)
      .insert(batch)
      .select();

    if (error) {
      console.error(`❌ Failed to insert batch: ${error.message}`);
      console.error('Error details:', error);
      continue;
    }

    inserted += data.length;
    console.log(`   ✅ Inserted ${data.length} properties`);
  }

  console.log(`\n✅ Successfully inserted ${inserted}/${properties.length} properties\n`);

  return inserted;
}

/**
 * Main function
 */
async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('🔄 Updating Properties from Numbers File');
  console.log('='.repeat(60) + '\n');

  try {
    // Step 1: Delete all existing properties
    await deleteAllProperties();

    // Step 2: Import from CSV
    const csvPath = '/Users/seong-won-yeong/Dev/ga4TechIssueCatcher/data/properties-import.csv';
    const insertedCount = await importPropertiesFromCSV(csvPath);

    // Step 3: Summary
    const { count, error: countError } = await supabase
      .from(Tables.PROPERTIES)
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('⚠️  Failed to get total count');
    } else {
      console.log('='.repeat(60));
      console.log(`📊 Total properties in database: ${count}`);
      console.log('='.repeat(60) + '\n');
    }

    console.log('✅ Update completed successfully!\n');

  } catch (error) {
    console.error('\n💥 Update failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run update
main();
