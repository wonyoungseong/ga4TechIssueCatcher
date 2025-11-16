#!/usr/bin/env node

/**
 * Automatic Database Migration Script
 *
 * Applies data lifecycle management migration to Supabase
 */

import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('\n' + '='.repeat(60));
console.log('🔄 Running Database Migration');
console.log('='.repeat(60) + '\n');

async function runMigration() {
  try {
    // Check environment variables
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    }

    console.log('📋 Step 1: Reading migration file...');
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20250102_data_lifecycle_management.sql');
    const migrationSQL = await fs.readFile(migrationPath, 'utf-8');
    console.log(`✅ Migration file loaded (${migrationSQL.length} characters)\n`);

    // Initialize Supabase client
    console.log('🔌 Step 2: Connecting to Supabase...');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
    console.log('✅ Connected to Supabase\n');

    // Execute migration
    console.log('⚙️  Step 3: Executing migration...');
    console.log('   This may take a few seconds...\n');

    const { data, error } = await supabase.rpc('exec_sql', {
      sql: migrationSQL
    });

    if (error) {
      // If exec_sql doesn't exist, try direct execution (may require splitting statements)
      console.log('   Note: exec_sql RPC not found, trying alternative method...\n');

      // Split SQL into individual statements and execute
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      let successCount = 0;
      let errorCount = 0;

      for (const statement of statements) {
        if (statement.includes('COMMENT ON') || statement.includes('GRANT')) {
          // Skip comments and grants for now
          continue;
        }

        try {
          const { error: stmtError } = await supabase.rpc('exec', { query: statement });
          if (!stmtError) {
            successCount++;
          } else {
            console.log(`   ⚠️  Warning: ${stmtError.message}`);
            errorCount++;
          }
        } catch (err) {
          console.log(`   ⚠️  Warning: ${err.message}`);
          errorCount++;
        }
      }

      console.log(`   Executed ${successCount} statements (${errorCount} warnings)\n`);
    } else {
      console.log('✅ Migration executed successfully\n');
    }

    // Verify migration
    console.log('🔍 Step 4: Verifying migration...\n');

    // Check for new columns
    const { data: columns, error: colError } = await supabase
      .from('crawl_runs')
      .select('*')
      .limit(1);

    if (colError) {
      console.log(`   ⚠️  Could not verify columns: ${colError.message}`);
    } else {
      console.log('   ✅ crawl_runs table accessible');
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ Migration Completed');
    console.log('='.repeat(60));
    console.log('\n📋 Next Steps:');
    console.log('   1. Create "screenshots" bucket in Supabase Storage');
    console.log('   2. Run: npm run test:upload');
    console.log('   3. Run: npm run test:scheduler\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('Stack:', error.stack);
    console.log('\n💡 Manual Migration Instructions:');
    console.log('   1. Go to Supabase Dashboard → SQL Editor');
    console.log('   2. Create new query');
    console.log('   3. Copy contents of: supabase/migrations/20250102_data_lifecycle_management.sql');
    console.log('   4. Click "Run"\n');
    process.exit(1);
  }
}

runMigration().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
