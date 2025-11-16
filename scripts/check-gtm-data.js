/**
 * Check current GTM data in database
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkGTMData() {
  console.log('🔍 Checking GTM data in database...\n');

  try {
    // Get some sample data with property names
    const { data: results, error } = await supabase
      .from('crawl_results')
      .select(`
        id,
        collected_gtm_id,
        properties (
          property_name,
          expected_gtm_id
        )
      `)
      .not('collected_gtm_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      throw error;
    }

    console.log(`📊 Found ${results?.length || 0} recent records with GTM data:\n`);

    results?.forEach((result, index) => {
      const propertyName = result.properties?.property_name || 'Unknown';
      const expectedGTM = result.properties?.expected_gtm_id || 'None';
      const collectedGTM = result.collected_gtm_id;
      const isArray = Array.isArray(collectedGTM);

      console.log(`${index + 1}. ${propertyName}`);
      console.log(`   Expected: ${expectedGTM}`);
      console.log(`   Collected: ${JSON.stringify(collectedGTM)}`);
      console.log(`   Type: ${isArray ? 'Array' : 'String'}`);

      if (isArray) {
        const expectedInArray = collectedGTM.some(gtm =>
          gtm && gtm.trim().toUpperCase() === expectedGTM.trim().toUpperCase()
        );
        console.log(`   Match: ${expectedInArray ? '✅ Found in array' : '❌ Not found in array'}`);
      } else {
        const match = collectedGTM?.trim().toUpperCase() === expectedGTM?.trim().toUpperCase();
        console.log(`   Match: ${match ? '✅ Exact match' : '❌ Mismatch'}`);
      }
      console.log('');
    });

    // Check column type
    const { data: columnInfo, error: columnError } = await supabase
      .rpc('exec_sql', {
        sql: `
          SELECT column_name, data_type, udt_name
          FROM information_schema.columns
          WHERE table_name = 'crawl_results' AND column_name = 'collected_gtm_id';
        `
      });

    if (!columnError && columnInfo) {
      console.log('📋 Column Type Information:');
      console.log(columnInfo);
    } else {
      console.log('⚠️  Could not fetch column type info (this is expected if RPC is not available)');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkGTMData();
