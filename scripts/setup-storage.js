#!/usr/bin/env node

/**
 * Storage Bucket Setup Script
 *
 * This script creates and configures the 'screenshots' bucket in local Supabase Storage.
 *
 * Configuration:
 * - Bucket name: screenshots
 * - Public access: true
 * - Allowed MIME types: image/jpeg, image/jpg, image/png
 * - File size limit: 10MB
 *
 * Usage:
 *   node scripts/setup-storage.js
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:8000';
const SUPABASE_SERVICE_KEY = process.env.SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET_NAME = 'screenshots';

// Validate environment variables
if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ Error: SERVICE_KEY or SUPABASE_SERVICE_ROLE_KEY not found in .env.local');
  console.error('Please ensure .env.local file exists and contains the service role key.');
  process.exit(1);
}

// Initialize Supabase client with service role
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function setupStorage() {
  console.log('🪣 Setting up Supabase Storage...');
  console.log(`📍 URL: ${SUPABASE_URL}`);
  console.log(`📦 Bucket: ${BUCKET_NAME}\n`);

  try {
    // Step 1: Check if bucket already exists
    console.log('1️⃣  Checking if bucket exists...');
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();

    if (listError) {
      throw new Error(`Failed to list buckets: ${listError.message}`);
    }

    const bucketExists = buckets.some(bucket => bucket.name === BUCKET_NAME);

    if (bucketExists) {
      console.log(`✅ Bucket '${BUCKET_NAME}' already exists\n`);

      // Update bucket configuration
      console.log('2️⃣  Updating bucket configuration...');
      const { data: updateData, error: updateError } = await supabase.storage.updateBucket(
        BUCKET_NAME,
        {
          public: true,
          fileSizeLimit: 10485760, // 10MB in bytes
          allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png']
        }
      );

      if (updateError) {
        console.warn(`⚠️  Warning: Could not update bucket: ${updateError.message}`);
      } else {
        console.log('✅ Bucket configuration updated\n');
      }
    } else {
      // Step 2: Create bucket
      console.log('2️⃣  Creating bucket...');
      const { data: createData, error: createError } = await supabase.storage.createBucket(
        BUCKET_NAME,
        {
          public: true,
          fileSizeLimit: 10485760, // 10MB in bytes
          allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png']
        }
      );

      if (createError) {
        throw new Error(`Failed to create bucket: ${createError.message}`);
      }

      console.log(`✅ Bucket '${BUCKET_NAME}' created successfully\n`);
    }

    // Step 3: Verify bucket configuration
    console.log('3️⃣  Verifying bucket configuration...');
    const { data: bucket, error: getError } = await supabase.storage.getBucket(BUCKET_NAME);

    if (getError) {
      throw new Error(`Failed to get bucket details: ${getError.message}`);
    }

    console.log('📋 Bucket Configuration:');
    console.log(`   Name: ${bucket.name}`);
    console.log(`   Public: ${bucket.public}`);
    console.log(`   File Size Limit: ${(bucket.file_size_limit / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Allowed MIME Types: ${bucket.allowed_mime_types ? bucket.allowed_mime_types.join(', ') : 'All types'}`);
    console.log(`   Created: ${bucket.created_at}`);
    console.log(`   Updated: ${bucket.updated_at}\n`);

    // Step 4: Test upload (optional)
    console.log('4️⃣  Testing bucket with sample upload...');
    const testFileName = `test-${Date.now()}.txt`;
    const testContent = 'Storage bucket test file';

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(testFileName, Buffer.from(testContent), {
        contentType: 'text/plain',
        upsert: false
      });

    if (uploadError) {
      console.warn(`⚠️  Warning: Test upload failed: ${uploadError.message}`);
    } else {
      console.log(`✅ Test file uploaded: ${uploadData.path}`);

      // Clean up test file
      const { error: deleteError } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([testFileName]);

      if (deleteError) {
        console.warn(`⚠️  Warning: Could not delete test file: ${deleteError.message}`);
      } else {
        console.log(`✅ Test file cleaned up\n`);
      }
    }

    // Success summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Storage setup completed successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('🎉 You can now upload screenshots to the bucket:');
    console.log(`   URL: ${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/`);
    console.log(`   Bucket: ${BUCKET_NAME}`);
    console.log(`   Access via Supabase Studio: http://localhost:3001\n`);

  } catch (error) {
    console.error('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ Storage setup failed');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error(`Error: ${error.message}\n`);
    console.error('Troubleshooting:');
    console.error('1. Ensure Docker services are running: docker-compose ps');
    console.error('2. Check Storage API logs: docker-compose logs storage');
    console.error('3. Verify .env.local contains correct SERVICE_KEY');
    console.error('4. Ensure Storage API is accessible: curl http://localhost:5000/storage/v1/version\n');
    process.exit(1);
  }
}

// Run setup
setupStorage();
