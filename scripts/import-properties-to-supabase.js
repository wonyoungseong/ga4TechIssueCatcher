#!/usr/bin/env node

/**
 * Import Properties to Supabase
 *
 * Imports GA4 properties from CSV file to Supabase database.
 * This is a one-time setup script or can be used for syncing.
 */

import 'dotenv/config';
import { supabase, Tables, PropertyStatus } from '../src/utils/supabase.js';
import { loadPropertiesFromCSV } from '../src/modules/csvPropertyManager.js';
import logger from '../src/utils/logger.js';

/**
 * Generate URL-safe slug from property name or URL
 *
 * @param {string} name - Property name
 * @param {string} url - Property URL
 * @returns {string} Slug
 */
function generateSlug(name, url) {
  // Try to extract domain from URL
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    const domain = urlObj.hostname.replace(/^www\./, '');
    const path = urlObj.pathname.replace(/\/$/, '').replace(/^\//, '');

    // Combine domain and path for uniqueness
    let slug = domain;
    if (path && path !== '') {
      slug += '-' + path.replace(/\//g, '-');
    }

    return slug.replace(/[^a-z0-9-]/gi, '-').toLowerCase().substring(0, 100);
  } catch {
    // Fallback to name-based slug with unique suffix
    const base = name
      .toLowerCase()
      .replace(/\[/g, '')
      .replace(/\]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 80);

    // Add a short hash for uniqueness
    const hash = Buffer.from(url).toString('base64').substring(0, 8).replace(/[^a-z0-9]/gi, '');
    return `${base}-${hash}`.toLowerCase();
  }
}

/**
 * Import properties from CSV to Supabase
 */
async function importProperties() {
  console.log('\n' + '='.repeat(60));
  console.log('🔄 Importing Properties to Supabase');
  console.log('='.repeat(60) + '\n');

  try {
    // Load properties from CSV
    const csvPath = process.env.CSV_PATH || './src/ga4Property/Amore_GA4_PropertList.csv';
    console.log(`📄 Loading properties from: ${csvPath}`);

    const properties = await loadPropertiesFromCSV(csvPath);
    console.log(`✅ Loaded ${properties.length} properties from CSV\n`);

    if (properties.length === 0) {
      console.log('⚠️  No properties found in CSV file');
      return;
    }

    // Check if properties already exist
    const { data: existingProperties, error: fetchError } = await supabase
      .from(Tables.PROPERTIES)
      .select('url');

    if (fetchError) {
      throw new Error(`Failed to fetch existing properties: ${fetchError.message}`);
    }

    const existingUrls = new Set(existingProperties?.map(p => p.url) || []);
    console.log(`📊 Found ${existingUrls.size} existing properties in database\n`);

    // Prepare properties for insertion
    const propertiesToInsert = [];
    const propertiesToUpdate = [];

    for (const prop of properties) {
      const slug = generateSlug(prop.propertyName, prop.representativeUrl);

      const propertyData = {
        property_name: prop.propertyName,
        url: prop.representativeUrl,
        slug: slug,
        expected_ga4_id: prop.measurementId || null,
        expected_gtm_id: prop.webGtmId || null,
        current_status: PropertyStatus.NORMAL,
        brand: prop.accountName || null,
        region: null, // CSV doesn't have region field
        is_active: true
      };

      if (existingUrls.has(prop.representativeUrl)) {
        propertiesToUpdate.push(propertyData);
      } else {
        propertiesToInsert.push(propertyData);
      }
    }

    console.log(`📥 New properties to insert: ${propertiesToInsert.length}`);
    console.log(`🔄 Existing properties to update: ${propertiesToUpdate.length}\n`);

    // Insert new properties
    if (propertiesToInsert.length > 0) {
      console.log('➕ Inserting new properties...');

      const { data: inserted, error: insertError } = await supabase
        .from(Tables.PROPERTIES)
        .insert(propertiesToInsert)
        .select();

      if (insertError) {
        throw new Error(`Failed to insert properties: ${insertError.message}`);
      }

      console.log(`✅ Successfully inserted ${inserted.length} properties\n`);
    }

    // Update existing properties
    if (propertiesToUpdate.length > 0) {
      console.log('🔄 Updating existing properties...');

      let updateCount = 0;
      for (const prop of propertiesToUpdate) {
        const { error: updateError } = await supabase
          .from(Tables.PROPERTIES)
          .update({
            property_name: prop.property_name,
            slug: prop.slug,
            expected_ga4_id: prop.expected_ga4_id,
            expected_gtm_id: prop.expected_gtm_id,
            brand: prop.brand
          })
          .eq('url', prop.url);

        if (updateError) {
          console.error(`⚠️  Failed to update ${prop.url}: ${updateError.message}`);
        } else {
          updateCount++;
        }
      }

      console.log(`✅ Successfully updated ${updateCount} properties\n`);
    }

    // Summary
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

    console.log('✅ Import completed successfully!\n');

  } catch (error) {
    console.error('\n💥 Import failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run import
importProperties();
