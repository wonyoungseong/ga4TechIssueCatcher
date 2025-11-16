#!/usr/bin/env node

/**
 * Automatic Storage Bucket Creation Script
 *
 * Creates the "screenshots" bucket in Supabase Storage
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

console.log('\n' + '='.repeat(60));
console.log('📦 Creating Supabase Storage Bucket');
console.log('='.repeat(60) + '\n');

async function createBucket() {
  try {
    // Check environment variables
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    }

    console.log('🔌 Step 1: Connecting to Supabase...');
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

    // Check if bucket already exists
    console.log('🔍 Step 2: Checking if bucket exists...');
    const { data: existingBuckets, error: listError } = await supabase
      .storage
      .listBuckets();

    if (listError) {
      throw new Error(`Failed to list buckets: ${listError.message}`);
    }

    const bucketExists = existingBuckets.some(bucket => bucket.name === 'screenshots');

    if (bucketExists) {
      console.log('✅ Bucket "screenshots" already exists\n');
      console.log('='.repeat(60));
      console.log('✅ Storage Setup Complete');
      console.log('='.repeat(60) + '\n');
      return;
    }

    console.log('📝 Bucket does not exist, creating...\n');

    // Create bucket
    console.log('⚙️  Step 3: Creating "screenshots" bucket...');
    const { data, error } = await supabase
      .storage
      .createBucket('screenshots', {
        public: true,
        fileSizeLimit: 10485760, // 10MB
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg']
      });

    if (error) {
      throw new Error(`Failed to create bucket: ${error.message}`);
    }

    console.log('✅ Bucket created successfully\n');

    // Verify bucket
    console.log('🔍 Step 4: Verifying bucket...');
    const { data: buckets } = await supabase.storage.listBuckets();
    const createdBucket = buckets.find(b => b.name === 'screenshots');

    if (createdBucket) {
      console.log('✅ Bucket verified');
      console.log(`   - Name: ${createdBucket.name}`);
      console.log(`   - ID: ${createdBucket.id}`);
      console.log(`   - Public: ${createdBucket.public}`);
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ Storage Setup Complete');
    console.log('='.repeat(60));
    console.log('\n📋 Next Steps:');
    console.log('   1. Run: npm run test:upload');
    console.log('   2. Run: npm run test:scheduler\n');

  } catch (error) {
    console.error('\n❌ Bucket creation failed:', error.message);
    console.error('Stack:', error.stack);
    console.log('\n💡 Manual Bucket Creation Instructions:');
    console.log('   1. Go to Supabase Dashboard → Storage');
    console.log('   2. Click "New bucket"');
    console.log('   3. Name: "screenshots"');
    console.log('   4. Public bucket: ✅ Checked');
    console.log('   5. Click "Create bucket"\n');
    process.exit(1);
  }
}

createBucket().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
