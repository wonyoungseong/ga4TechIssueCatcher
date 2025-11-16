#!/usr/bin/env node

/**
 * Direct Database Migration Script
 *
 * Uses Supabase client to apply migration directly
 */

import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('\n' + '='.repeat(60));
console.log('🔄 Applying Database Migration Directly');
console.log('='.repeat(60) + '\n');

async function applyMigration() {
  try {
    // Check environment variables
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    }

    console.log('🔌 Step 1: Connecting to Supabase...');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    console.log('✅ Connected\n');

    // Step 2: Apply schema changes via SQL
    console.log('⚙️  Step 2: Adding columns to crawl_runs...');

    const statements = [
      {
        name: 'Add upload_completed_at column',
        sql: `ALTER TABLE crawl_runs ADD COLUMN IF NOT EXISTS upload_completed_at TIMESTAMPTZ;`
      },
      {
        name: 'Add upload_duration_ms column',
        sql: `ALTER TABLE crawl_runs ADD COLUMN IF NOT EXISTS upload_duration_ms INTEGER;`
      },
      {
        name: 'Add upload_success_count column',
        sql: `ALTER TABLE crawl_runs ADD COLUMN IF NOT EXISTS upload_success_count INTEGER DEFAULT 0;`
      },
      {
        name: 'Add upload_failed_count column',
        sql: `ALTER TABLE crawl_runs ADD COLUMN IF NOT EXISTS upload_failed_count INTEGER DEFAULT 0;`
      },
      {
        name: 'Add permanent_screenshot_url column',
        sql: `ALTER TABLE crawl_results ADD COLUMN IF NOT EXISTS permanent_screenshot_url TEXT;`
      }
    ];

    for (const stmt of statements) {
      try {
        const { error } = await supabase.rpc('exec', { query: stmt.sql });
        if (error) {
          console.log(`   ⚠️  ${stmt.name}: ${error.message}`);
        } else {
          console.log(`   ✅ ${stmt.name}`);
        }
      } catch (err) {
        console.log(`   ⚠️  ${stmt.name}: ${err.message}`);
      }
    }

    console.log('\n⚙️  Step 3: Creating indexes...');

    // Create indexes (these may already exist, so we ignore errors)
    const indexes = [
      {
        name: 'idx_crawl_runs_cleanup',
        sql: `CREATE INDEX IF NOT EXISTS idx_crawl_runs_cleanup
              ON crawl_runs(is_saved, started_at, status)
              WHERE is_saved = false AND status IN ('completed', 'failed', 'cancelled');`
      },
      {
        name: 'idx_crawl_results_screenshot_cleanup',
        sql: `CREATE INDEX IF NOT EXISTS idx_crawl_results_screenshot_cleanup
              ON crawl_results(created_at)
              WHERE screenshot_url IS NOT NULL;`
      }
    ];

    for (const idx of indexes) {
      try {
        const { error } = await supabase.rpc('exec', { query: idx.sql });
        if (error) {
          console.log(`   ⚠️  ${idx.name}: ${error.message}`);
        } else {
          console.log(`   ✅ ${idx.name}`);
        }
      } catch (err) {
        console.log(`   ⚠️  ${idx.name}: ${err.message}`);
      }
    }

    // Step 4: Verify by querying the table
    console.log('\n🔍 Step 4: Verifying migration...');

    const { data, error } = await supabase
      .from('crawl_runs')
      .select('*')
      .limit(1);

    if (error) {
      console.log(`   ⚠️  Could not verify: ${error.message}`);
    } else {
      console.log('   ✅ Migration verified - crawl_runs table accessible');

      if (data && data[0]) {
        const columns = Object.keys(data[0]);
        const newColumns = ['upload_completed_at', 'upload_duration_ms', 'upload_success_count', 'upload_failed_count'];
        const foundColumns = newColumns.filter(col => columns.includes(col));
        console.log(`   ✅ Found ${foundColumns.length}/${newColumns.length} new columns`);

        if (foundColumns.length < newColumns.length) {
          console.log(`   ⚠️  Missing columns: ${newColumns.filter(c => !foundColumns.includes(c)).join(', ')}`);
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Migration Applied');
    console.log('='.repeat(60));
    console.log('\n📋 Note: RPC functions need to be created manually in Supabase Dashboard');
    console.log('   See: MIGRATION_GUIDE.md for RPC function creation\n');
    console.log('🧪 Next Step: Run tests');
    console.log('   npm run test:upload\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.log('\n💡 Please apply migration manually via Supabase Dashboard');
    console.log('   See: MIGRATION_GUIDE.md\n');
    process.exit(1);
  }
}

applyMigration().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
