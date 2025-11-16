/**
 * Migrate collected_gtm_id column from TEXT to TEXT[] (Array)
 *
 * This script directly executes the database migration using Supabase client
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrateGTMColumn() {
  console.log('🔄 Starting GTM column migration to TEXT[] array type...\n');

  try {
    // Step 1: Check current column type
    console.log('📋 Step 1: Checking current column type...');
    const { data: beforeData, error: beforeError } = await supabase
      .from('crawl_results')
      .select('id, collected_gtm_id')
      .not('collected_gtm_id', 'is', null)
      .limit(3);

    if (beforeError) {
      console.error('❌ Error fetching current data:', beforeError.message);
    } else {
      console.log(`✅ Found ${beforeData?.length || 0} sample records with GTM data`);
      console.log('Current data format:', beforeData);
    }

    // Step 2: Execute migration SQL using rpc
    console.log('\n🔧 Step 2: Executing column type migration...');

    const migrationSQL = `
      -- Alter the column type to TEXT[]
      ALTER TABLE crawl_results
      ALTER COLUMN collected_gtm_id TYPE TEXT[]
      USING CASE
        -- If the current value is not null/empty, convert it to an array with single element
        WHEN collected_gtm_id IS NOT NULL AND collected_gtm_id != '' THEN ARRAY[collected_gtm_id]::TEXT[]
        -- Otherwise, use an empty array
        ELSE '{}'::TEXT[]
      END;

      -- Set default value for new records
      ALTER TABLE crawl_results
      ALTER COLUMN collected_gtm_id SET DEFAULT '{}';
    `;

    // Try using Supabase SQL directly
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({ sql: migrationSQL })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Migration failed: ${response.status} ${response.statusText}\n${errorText}`);
    }

    console.log('✅ Column type migration completed successfully!');

    // Step 3: Verify the migration
    console.log('\n🔍 Step 3: Verifying migration...');

    const { data: afterData, error: afterError } = await supabase
      .from('crawl_results')
      .select('id, collected_gtm_id')
      .not('collected_gtm_id', 'is', null)
      .limit(5);

    if (afterError) {
      console.error('⚠️ Verification error:', afterError.message);
    } else {
      console.log('✅ Migration verified! Sample data:');
      afterData?.forEach((row, index) => {
        console.log(`${index + 1}. ID: ${row.id}`);
        console.log(`   GTM: ${JSON.stringify(row.collected_gtm_id)}`);
        console.log(`   Type: ${Array.isArray(row.collected_gtm_id) ? 'Array ✅' : 'String ❌'}`);
        console.log('');
      });
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📊 Next steps:');
    console.log('1. Run a new crawl to collect GTM data');
    console.log('2. Multiple GTM IDs will now be stored as arrays');
    console.log('3. VitalBeauty and similar sites should show correct validation');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.log('\n⚠️ Alternative: Execute the following SQL manually in Supabase SQL Editor:');
    console.log('--------------------------------------------------');
    console.log(`
ALTER TABLE crawl_results
ALTER COLUMN collected_gtm_id TYPE TEXT[]
USING CASE
  WHEN collected_gtm_id IS NOT NULL AND collected_gtm_id != ''
    THEN ARRAY[collected_gtm_id]::TEXT[]
  ELSE '{}'::TEXT[]
END;

ALTER TABLE crawl_results
ALTER COLUMN collected_gtm_id SET DEFAULT '{}';
    `);
    console.log('--------------------------------------------------');
    process.exit(1);
  }
}

migrateGTMColumn();
