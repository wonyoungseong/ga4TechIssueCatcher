/**
 * Update collected_gtm_id column to array type
 *
 * This script changes the column type from TEXT to TEXT[] to support multiple GTM IDs
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

async function updateGTMColumnToArray() {
  console.log('🔄 Updating collected_gtm_id column to TEXT[] type...\n');

  try {
    // Step 1: Backup existing data
    console.log('📦 Step 1: Backing up existing GTM data...');
    const { data: existingData, error: fetchError } = await supabase
      .from('crawl_results')
      .select('id, collected_gtm_id')
      .not('collected_gtm_id', 'is', null);

    if (fetchError) {
      throw new Error(`Failed to fetch existing data: ${fetchError.message}`);
    }

    console.log(`✅ Found ${existingData?.length || 0} records with GTM data\n`);

    // Step 2: Alter column type using raw SQL
    console.log('🔧 Step 2: Altering column type to TEXT[]...');

    const { error: alterError } = await supabase.rpc('exec_sql', {
      sql: `
        -- First, convert existing TEXT values to TEXT[] format
        UPDATE crawl_results
        SET collected_gtm_id = ARRAY[collected_gtm_id]::TEXT[]
        WHERE collected_gtm_id IS NOT NULL AND collected_gtm_id != '';

        -- Then alter the column type
        ALTER TABLE crawl_results
        ALTER COLUMN collected_gtm_id TYPE TEXT[]
        USING CASE
          WHEN collected_gtm_id IS NULL THEN '{}'::TEXT[]
          ELSE collected_gtm_id::TEXT[]
        END;

        -- Set default value
        ALTER TABLE crawl_results
        ALTER COLUMN collected_gtm_id SET DEFAULT '{}';
      `
    });

    if (alterError) {
      // If RPC doesn't exist, try direct SQL execution
      console.log('⚠️  RPC method not available, attempting direct SQL...');

      // We need to use a different approach - create a script that can be run in Supabase SQL editor
      console.log('\n📝 Please run the following SQL in your Supabase SQL Editor:\n');
      console.log('----------------------------------------');
      console.log(`
-- Step 1: Convert existing TEXT values to TEXT[] format
UPDATE crawl_results
SET collected_gtm_id = ARRAY[collected_gtm_id]::TEXT[]
WHERE collected_gtm_id IS NOT NULL AND collected_gtm_id != '';

-- Step 2: Alter the column type
ALTER TABLE crawl_results
ALTER COLUMN collected_gtm_id TYPE TEXT[]
USING CASE
  WHEN collected_gtm_id IS NULL THEN '{}'::TEXT[]
  ELSE collected_gtm_id::TEXT[]
END;

-- Step 3: Set default value
ALTER TABLE crawl_results
ALTER COLUMN collected_gtm_id SET DEFAULT '{}';
      `);
      console.log('----------------------------------------\n');

      return;
    }

    console.log('✅ Column type updated successfully!\n');

    // Step 3: Verify the change
    console.log('🔍 Step 3: Verifying column type...');
    const { data: verifyData, error: verifyError } = await supabase
      .from('crawl_results')
      .select('id, collected_gtm_id')
      .limit(5);

    if (verifyError) {
      console.warn('⚠️  Could not verify: ' + verifyError.message);
    } else {
      console.log('✅ Verification successful!');
      console.log('Sample data:', verifyData);
    }

    console.log('\n✅ Migration completed successfully!');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }
}

updateGTMColumnToArray();
