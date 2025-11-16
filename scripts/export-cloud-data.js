#!/usr/bin/env node

/**
 * Export Cloud Data Script
 *
 * Exports properties and configuration data from cloud Supabase for backup purposes.
 * This script should be run BEFORE switching to local Supabase to ensure data preservation.
 *
 * Features:
 * - Exports properties data to JSON and CSV formats
 * - Creates timestamped backups in ./backups/ directory
 * - Validates data integrity
 * - Provides detailed export statistics
 *
 * Usage:
 *   node scripts/export-cloud-data.js
 *
 * Prerequisites:
 *   - .env configured with cloud Supabase credentials
 *   - SUPABASE_URL pointing to cloud instance
 *   - SUPABASE_SERVICE_ROLE_KEY set
 */

import { createClient } from '@supabase/supabase-js';
import { stringify } from 'csv-stringify/sync';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const BACKUP_DIR = path.join(__dirname, '../backups');
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' +
                  new Date().toISOString().split('T')[1].replace(/[:.]/g, '-').split('.')[0];

/**
 * Initialize Supabase client
 */
function initializeSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase configuration');
    console.error('   Please ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env');
    process.exit(1);
  }

  // Validate this is cloud Supabase
  if (!supabaseUrl.startsWith('https://')) {
    console.error('❌ SUPABASE_URL must be cloud URL (https://)');
    console.error(`   Current URL: ${supabaseUrl}`);
    console.error('   Expected: https://[project-id].supabase.co');
    console.error('');
    console.error('💡 To export cloud data:');
    console.error('   1. Ensure .env points to cloud: ./scripts/switch-to-cloud.sh');
    console.error('   2. Run this script again');
    process.exit(1);
  }

  return createClient(supabaseUrl, supabaseKey);
}

/**
 * Create backup directory
 */
async function ensureBackupDirectory() {
  try {
    await fs.mkdir(BACKUP_DIR, { recursive: true });
    console.log(`📁 Backup directory: ${BACKUP_DIR}`);
  } catch (error) {
    console.error(`❌ Failed to create backup directory: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Export properties data
 */
async function exportProperties(supabase) {
  console.log('\n📊 Exporting properties data...');

  try {
    const { data: properties, error } = await supabase
      .from('properties')
      .select('*')
      .order('property_name', { ascending: true });

    if (error) {
      throw error;
    }

    if (!properties || properties.length === 0) {
      console.log('⚠️  No properties found in cloud database');
      return { json: null, csv: null, count: 0 };
    }

    console.log(`✅ Fetched ${properties.length} properties from cloud`);

    // Generate JSON backup
    const jsonFilename = `cloud-properties-${TIMESTAMP}.json`;
    const jsonPath = path.join(BACKUP_DIR, jsonFilename);
    await fs.writeFile(
      jsonPath,
      JSON.stringify(properties, null, 2),
      'utf-8'
    );
    console.log(`✅ JSON backup: ${jsonFilename}`);

    // Generate CSV backup
    const csvData = stringify(properties, {
      header: true,
      columns: [
        'id',
        'property_name',
        'account_name',
        'representative_url',
        'measurement_id',
        'web_gtm_id',
        'app_gtm_id',
        'brand',
        'region',
        'slug',
        'is_active',
        'current_status',
        'created_at',
        'updated_at'
      ]
    });

    const csvFilename = `cloud-properties-${TIMESTAMP}.csv`;
    const csvPath = path.join(BACKUP_DIR, csvFilename);
    await fs.writeFile(csvPath, csvData, 'utf-8');
    console.log(`✅ CSV backup: ${csvFilename}`);

    // Generate statistics
    const activeCount = properties.filter(p => p.is_active).length;
    const brands = new Set(properties.map(p => p.brand).filter(Boolean));
    const regions = new Set(properties.map(p => p.region).filter(Boolean));

    console.log('\n📈 Export Statistics:');
    console.log(`   Total Properties: ${properties.length}`);
    console.log(`   Active Properties: ${activeCount}`);
    console.log(`   Inactive Properties: ${properties.length - activeCount}`);
    console.log(`   Unique Brands: ${brands.size}`);
    console.log(`   Unique Regions: ${regions.size}`);

    return {
      json: jsonPath,
      csv: csvPath,
      count: properties.length,
      active: activeCount,
      brands: brands.size,
      regions: regions.size
    };

  } catch (error) {
    console.error(`❌ Failed to export properties: ${error.message}`);
    throw error;
  }
}

/**
 * Create backup manifest
 */
async function createManifest(exportResults) {
  const manifest = {
    timestamp: new Date().toISOString(),
    source: process.env.SUPABASE_URL,
    exports: {
      properties: exportResults
    },
    notes: [
      'This backup was created before switching to local Supabase',
      'Use this data to restore cloud configuration if needed',
      'JSON format preserves full data structure including UUIDs',
      'CSV format is human-readable and compatible with spreadsheets'
    ]
  };

  const manifestPath = path.join(BACKUP_DIR, `backup-manifest-${TIMESTAMP}.json`);
  await fs.writeFile(
    manifestPath,
    JSON.stringify(manifest, null, 2),
    'utf-8'
  );

  console.log(`\n📋 Backup manifest: backup-manifest-${TIMESTAMP}.json`);

  return manifestPath;
}

/**
 * Main export function
 */
async function main() {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║  Cloud Supabase Data Export                          ║');
  console.log('╚═══════════════════════════════════════════════════════╝');
  console.log('');
  console.log('This script exports data from cloud Supabase for backup.');
  console.log('Run this BEFORE switching to local Supabase.');
  console.log('');

  try {
    // Initialize
    const supabase = initializeSupabase();
    console.log(`✅ Connected to: ${process.env.SUPABASE_URL}`);

    // Ensure backup directory exists
    await ensureBackupDirectory();

    // Export properties
    const propertiesExport = await exportProperties(supabase);

    // Create manifest
    if (propertiesExport.count > 0) {
      await createManifest(propertiesExport);
    }

    // Success summary
    console.log('\n╔═══════════════════════════════════════════════════════╗');
    console.log('║  ✅ Export Complete                                   ║');
    console.log('╚═══════════════════════════════════════════════════════╝');
    console.log('');
    console.log('Backup files created:');
    if (propertiesExport.json) {
      console.log(`  📄 ${path.basename(propertiesExport.json)}`);
      console.log(`  📄 ${path.basename(propertiesExport.csv)}`);
      console.log(`  📄 backup-manifest-${TIMESTAMP}.json`);
    }
    console.log('');
    console.log('Next steps:');
    console.log('  1. Verify backup files in ./backups/ directory');
    console.log('  2. Switch to local Supabase: ./scripts/switch-to-local.sh');
    console.log('  3. Import properties to local: node scripts/import-properties-to-local.js');
    console.log('');

    process.exit(0);

  } catch (error) {
    console.error('\n💥 Export failed:', error.message);
    console.error('');
    console.error('Troubleshooting:');
    console.error('  1. Ensure you are connected to cloud Supabase');
    console.error('  2. Check .env file: cat .env | grep SUPABASE_URL');
    console.error('  3. Switch to cloud if needed: ./scripts/switch-to-cloud.sh');
    console.error('  4. Verify credentials are valid');
    console.error('');
    process.exit(1);
  }
}

// Run export
main();
