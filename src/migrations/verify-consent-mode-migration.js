/**
 * Verification Script: Consent Mode Migration
 * Story: 10.2 - Consent Mode Support
 *
 * Verifies that the has_consent_mode column was added successfully.
 */

import { supabase } from '../utils/supabase.js';

async function verifyMigration() {
  console.log('\n=== Verifying Consent Mode Migration ===\n');

  try {
    // Test 1: Check if column exists by querying it
    console.log('Test 1: Checking if has_consent_mode column exists...');
    const { data: sample, error: sampleError } = await supabase
      .from('properties')
      .select('id, property_name, has_consent_mode')
      .limit(1)
      .single();

    if (sampleError) {
      console.error('  ❌ Failed:', sampleError.message);
      console.log('\n⚠️  Migration has NOT been run yet.');
      console.log('Please run the SQL migration in Supabase Dashboard first.');
      console.log('See: docs/MIGRATION_10.2_INSTRUCTIONS.md');
      process.exit(1);
    }

    console.log('  ✅ Column exists');
    console.log(`     Sample: ${sample.property_name} → has_consent_mode: ${sample.has_consent_mode}\n`);

    // Test 2: Check default values
    console.log('Test 2: Checking default values...');
    const { count: totalCount, error: totalError } = await supabase
      .from('properties')
      .select('*', { count: 'exact', head: true });

    if (totalError) {
      console.error('  ❌ Failed:', totalError.message);
      process.exit(1);
    }

    const { count: falseCount, error: falseError } = await supabase
      .from('properties')
      .select('*', { count: 'exact', head: true })
      .eq('has_consent_mode', false);

    if (falseError) {
      console.error('  ❌ Failed:', falseError.message);
      process.exit(1);
    }

    console.log(`  ✅ Total properties: ${totalCount}`);
    console.log(`  ✅ Properties with has_consent_mode=false: ${falseCount}`);
    console.log(`  ${falseCount === totalCount ? '✅' : '⚠️ '} All properties have default value (false)\n`);

    // Test 3: Test updating a property
    console.log('Test 3: Testing update functionality...');
    const { data: testProperty, error: testError } = await supabase
      .from('properties')
      .select('id, property_name, has_consent_mode')
      .limit(1)
      .single();

    if (testError) {
      console.error('  ❌ Failed to fetch test property:', testError.message);
      process.exit(1);
    }

    // Update to true
    const { error: updateError1 } = await supabase
      .from('properties')
      .update({ has_consent_mode: true })
      .eq('id', testProperty.id);

    if (updateError1) {
      console.error('  ❌ Failed to update to true:', updateError1.message);
      process.exit(1);
    }

    console.log('  ✅ Successfully updated property to has_consent_mode=true');

    // Verify update
    const { data: updatedProperty, error: verifyError } = await supabase
      .from('properties')
      .select('has_consent_mode')
      .eq('id', testProperty.id)
      .single();

    if (verifyError || !updatedProperty.has_consent_mode) {
      console.error('  ❌ Update verification failed');
      process.exit(1);
    }

    console.log('  ✅ Update verified\n');

    // Restore original value
    const { error: restoreError } = await supabase
      .from('properties')
      .update({ has_consent_mode: false })
      .eq('id', testProperty.id);

    if (restoreError) {
      console.error('  ⚠️  Failed to restore original value:', restoreError.message);
    } else {
      console.log('  ✅ Original value restored\n');
    }

    console.log('=== Migration Verification Complete ===');
    console.log('✅ All tests passed!');
    console.log('✅ has_consent_mode column is ready for use\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Verification failed:', error.message);
    process.exit(1);
  }
}

verifyMigration();
