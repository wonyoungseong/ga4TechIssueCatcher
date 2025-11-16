#!/usr/bin/env node

/**
 * Apply database migration for retry_queue table
 * Story 10.3: Network Error Retry Queue System
 */

import supabase from './src/utils/supabase.js';
import fs from 'fs/promises';

async function applyMigration() {
  console.log('\n📦 Applying retry_queue migration...\n');

  try {
    // Read migration SQL file
    const migrationSQL = await fs.readFile('./supabase/migrations/004_retry_queue.sql', 'utf-8');

    console.log('✅ Migration file loaded');
    console.log('📝 Executing SQL...\n');

    // Execute migration SQL
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: migrationSQL
    });

    if (error) {
      // Try alternative approach using raw query
      console.log('⚠️  RPC method not available, trying direct execution...\n');

      // Split SQL into individual statements
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        if (statement.length === 0) continue;

        console.log(`Executing statement ${i + 1}/${statements.length}...`);

        // Use Supabase client to execute raw SQL
        const result = await supabase.rpc('exec', { sql: statement + ';' });

        if (result.error) {
          console.error(`❌ Error in statement ${i + 1}:`, result.error.message);
          console.error('Statement:', statement.substring(0, 100) + '...');
          throw result.error;
        }
      }

      console.log('\n✅ Migration applied successfully!');
    } else {
      console.log('✅ Migration applied successfully!');
      console.log('Response:', data);
    }

    // Verify table creation
    console.log('\n🔍 Verifying retry_queue table...');
    const { data: tables, error: tableError } = await supabase
      .from('retry_queue')
      .select('*')
      .limit(0);

    if (tableError) {
      console.error('❌ Table verification failed:', tableError.message);
    } else {
      console.log('✅ retry_queue table exists and is accessible');
    }

    console.log('\n✅ Migration complete!');
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nPlease apply the migration manually using Supabase Dashboard:');
    console.error('1. Go to your Supabase project dashboard');
    console.error('2. Navigate to SQL Editor');
    console.error('3. Copy and execute the SQL from: supabase/migrations/004_retry_queue.sql');
    process.exit(1);
  }
}

applyMigration();
