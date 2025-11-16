/**
 * Migration Runner: Add has_consent_mode column
 * Story: 10.2 - Consent Mode Support
 *
 * This script executes the consent mode migration on Supabase.
 */

import { supabase } from '../utils/supabase.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  console.log('\n=== Running Consent Mode Migration ===\n');

  try {
    // Read migration SQL file
    const sqlPath = path.join(__dirname, 'add_consent_mode_column.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Extract main SQL statements (remove comments and verification queries)
    const statements = sql
      .split('\n')
      .filter(line => !line.trim().startsWith('--') && line.trim().length > 0)
      .join('\n')
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.includes('SELECT'));

    console.log(`Found ${statements.length} SQL statements to execute\n`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`[${i + 1}/${statements.length}] Executing:`, statement.substring(0, 100) + '...');

      const { error } = await supabase.rpc('exec_sql', { query: statement + ';' });

      if (error) {
        // Try alternative method if RPC not available
        if (error.code === 'PGRST202' || error.message.includes('Could not find')) {
          console.log('  Note: Direct SQL execution not available via Supabase client');
          console.log('  Please run migration manually in Supabase SQL Editor');
          console.log('\n=== Manual Migration Instructions ===');
          console.log('1. Go to Supabase Dashboard → SQL Editor');
          console.log('2. Copy and paste the following SQL:\n');
          console.log(fs.readFileSync(sqlPath, 'utf8'));
          console.log('\n3. Click "Run" to execute the migration');
          return;
        }
        throw error;
      }

      console.log('  ✅ Success\n');
    }

    // Verify migration
    console.log('Verifying migration...');
    const { data, error: verifyError } = await supabase
      .from('properties')
      .select('has_consent_mode')
      .limit(1)
      .single();

    if (verifyError) {
      console.error('  ❌ Verification failed:', verifyError.message);
      console.log('\n=== Manual Migration Required ===');
      console.log('Please run the migration manually in Supabase SQL Editor:');
      console.log('File:', sqlPath);
      return;
    }

    console.log('  ✅ Column exists\n');

    // Check default values
    const { count, error: countError } = await supabase
      .from('properties')
      .select('*', { count: 'exact', head: true })
      .eq('has_consent_mode', false);

    if (!countError) {
      console.log(`  ✅ ${count} properties have has_consent_mode = false (default)\n`);
    }

    console.log('=== Migration Completed Successfully ===\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.log('\n=== Manual Migration Instructions ===');
    console.log('Run this SQL in Supabase Dashboard → SQL Editor:\n');
    const sqlPath = path.join(__dirname, 'add_consent_mode_column.sql');
    console.log(fs.readFileSync(sqlPath, 'utf8'));
    process.exit(1);
  }
}

// Execute migration
runMigration().then(() => {
  console.log('✅ Migration process completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Migration process failed:', error);
  process.exit(1);
});
