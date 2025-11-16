#!/usr/bin/env node

/**
 * Local Supabase Connection Test Script
 *
 * This script tests the connection to local Supabase instance running in Docker.
 * It validates database connectivity, table access, storage bucket, and auth service.
 *
 * Features:
 * - Database connection and authentication test
 * - Table structure verification
 * - Storage bucket access test
 * - File upload/download test
 * - Auth service health check
 * - Comprehensive error reporting
 *
 * Usage:
 *   node scripts/test-local-connection.js
 *
 * Prerequisites:
 *   - Local Supabase running: docker-compose up -d
 *   - .env file configured with local settings
 */

import { supabase, Tables } from '../src/utils/supabase.js';
import fs from 'fs';
import path from 'path';

// Test configuration
const TEST_BUCKET = 'screenshots';
const TEST_FILE_PATH = 'test-connection.txt';
const TEST_FILE_CONTENT = 'Test file for Supabase connection validation';

/**
 * Format test result with emoji
 */
function formatResult(passed, message) {
  return passed ? `✅ ${message}` : `❌ ${message}`;
}

/**
 * Test 1: Database Connection
 */
async function testDatabaseConnection() {
  console.log('\n📊 Test 1: Database Connection');
  console.log('─'.repeat(60));

  try {
    const { data, error } = await supabase
      .from(Tables.PROPERTIES)
      .select('count', { count: 'exact', head: true });

    if (error) {
      console.log(formatResult(false, `Database connection failed: ${error.message}`));
      return false;
    }

    console.log(formatResult(true, 'Database connection successful'));
    console.log(`   Properties count: ${data?.length || 0}`);
    return true;

  } catch (error) {
    console.log(formatResult(false, `Connection error: ${error.message}`));
    return false;
  }
}

/**
 * Test 2: Table Access
 */
async function testTableAccess() {
  console.log('\n📋 Test 2: Table Access Verification');
  console.log('─'.repeat(60));

  const tables = [
    Tables.PROPERTIES,
    Tables.CRAWL_RUNS,
    Tables.CRAWL_RESULTS,
    Tables.RETRY_QUEUE
  ];

  let allPassed = true;

  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);

      if (error) {
        console.log(formatResult(false, `Table '${table}' access failed: ${error.message}`));
        allPassed = false;
      } else {
        console.log(formatResult(true, `Table '${table}' accessible`));
      }
    } catch (error) {
      console.log(formatResult(false, `Table '${table}' error: ${error.message}`));
      allPassed = false;
    }
  }

  return allPassed;
}

/**
 * Test 3: Storage Bucket Access
 */
async function testStorageBucketAccess() {
  console.log('\n🗄️  Test 3: Storage Bucket Access');
  console.log('─'.repeat(60));

  try {
    // List buckets
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();

    if (listError) {
      console.log(formatResult(false, `Bucket listing failed: ${listError.message}`));
      return false;
    }

    const screenshotBucket = buckets?.find(b => b.name === TEST_BUCKET);

    if (!screenshotBucket) {
      console.log(formatResult(false, `Bucket '${TEST_BUCKET}' not found`));
      console.log('   Available buckets:', buckets?.map(b => b.name).join(', ') || 'none');
      return false;
    }

    console.log(formatResult(true, `Bucket '${TEST_BUCKET}' exists`));
    console.log(`   Bucket ID: ${screenshotBucket.id}`);
    console.log(`   Public: ${screenshotBucket.public}`);

    return true;

  } catch (error) {
    console.log(formatResult(false, `Storage access error: ${error.message}`));
    return false;
  }
}

/**
 * Test 4: File Upload/Download
 */
async function testFileUploadDownload() {
  console.log('\n📤 Test 4: File Upload/Download');
  console.log('─'.repeat(60));

  try {
    // Upload test file
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(TEST_BUCKET)
      .upload(TEST_FILE_PATH, TEST_FILE_CONTENT, {
        contentType: 'text/plain',
        upsert: true
      });

    if (uploadError) {
      console.log(formatResult(false, `File upload failed: ${uploadError.message}`));
      return false;
    }

    console.log(formatResult(true, 'File uploaded successfully'));
    console.log(`   Path: ${uploadData.path}`);

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(TEST_BUCKET)
      .getPublicUrl(TEST_FILE_PATH);

    console.log(formatResult(true, 'Public URL generated'));
    console.log(`   URL: ${publicUrl}`);

    // Download file
    const { data: downloadData, error: downloadError } = await supabase.storage
      .from(TEST_BUCKET)
      .download(TEST_FILE_PATH);

    if (downloadError) {
      console.log(formatResult(false, `File download failed: ${downloadError.message}`));
      return false;
    }

    const downloadedContent = await downloadData.text();
    const contentMatches = downloadedContent === TEST_FILE_CONTENT;

    console.log(formatResult(contentMatches, `File content ${contentMatches ? 'verified' : 'mismatch'}`));

    // Cleanup: Remove test file
    const { error: deleteError } = await supabase.storage
      .from(TEST_BUCKET)
      .remove([TEST_FILE_PATH]);

    if (!deleteError) {
      console.log(formatResult(true, 'Test file cleaned up'));
    }

    return contentMatches;

  } catch (error) {
    console.log(formatResult(false, `Upload/Download error: ${error.message}`));
    return false;
  }
}

/**
 * Test 5: Auth Service Health
 */
async function testAuthServiceHealth() {
  console.log('\n🔐 Test 5: Auth Service Health');
  console.log('─'.repeat(60));

  try {
    // Test auth by trying to get session
    const { data, error } = await supabase.auth.getSession();

    if (error && error.message !== 'No session found') {
      console.log(formatResult(false, `Auth service error: ${error.message}`));
      return false;
    }

    console.log(formatResult(true, 'Auth service is responding'));
    console.log(`   Session: ${data.session ? 'Active' : 'None (expected for service role)'}`);

    return true;

  } catch (error) {
    console.log(formatResult(false, `Auth service error: ${error.message}`));
    return false;
  }
}

/**
 * Test 6: Environment Configuration
 */
function testEnvironmentConfiguration() {
  console.log('\n⚙️  Test 6: Environment Configuration');
  console.log('─'.repeat(60));

  const requiredVars = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY'
  ];

  let allPresent = true;

  for (const varName of requiredVars) {
    const value = process.env[varName];
    const isPresent = !!value;

    console.log(formatResult(isPresent, `${varName} ${isPresent ? 'configured' : 'missing'}`));

    if (isPresent && varName === 'SUPABASE_URL') {
      const isLocal = value.includes('localhost') || value.includes('127.0.0.1');
      console.log(`   URL: ${value} ${isLocal ? '(LOCAL)' : '(CLOUD)'}`);
    }

    allPresent = allPresent && isPresent;
  }

  return allPresent;
}

/**
 * Main test runner
 */
async function runAllTests() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 Local Supabase Connection Test Suite');
  console.log('='.repeat(60));

  const results = {
    environment: false,
    database: false,
    tables: false,
    storage: false,
    fileOps: false,
    auth: false
  };

  // Test 6: Environment (synchronous, run first)
  results.environment = testEnvironmentConfiguration();

  // Run async tests
  results.database = await testDatabaseConnection();
  results.tables = await testTableAccess();
  results.storage = await testStorageBucketAccess();
  results.fileOps = await testFileUploadDownload();
  results.auth = await testAuthServiceHealth();

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary');
  console.log('='.repeat(60));

  const testNames = {
    environment: 'Environment Configuration',
    database: 'Database Connection',
    tables: 'Table Access',
    storage: 'Storage Bucket Access',
    fileOps: 'File Upload/Download',
    auth: 'Auth Service Health'
  };

  let passedCount = 0;
  let totalCount = Object.keys(results).length;

  for (const [key, passed] of Object.entries(results)) {
    console.log(formatResult(passed, testNames[key]));
    if (passed) passedCount++;
  }

  console.log('\n' + '─'.repeat(60));
  console.log(`Result: ${passedCount}/${totalCount} tests passed`);
  console.log('='.repeat(60));

  const allPassed = passedCount === totalCount;

  if (allPassed) {
    console.log('\n✅ All tests passed! Local Supabase connection is working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Please check the following:');
    console.log('   1. Is Docker running? (docker ps)');
    console.log('   2. Is Supabase stack running? (docker-compose ps)');
    console.log('   3. Are migrations applied? (check container logs)');
    console.log('   4. Is storage bucket created? (node scripts/setup-storage.js)');
  }

  console.log('\n📖 Troubleshooting:');
  console.log('   - Start services: docker-compose up -d');
  console.log('   - Check logs: docker-compose logs -f');
  console.log('   - Restart services: docker-compose restart');
  console.log('   - View Studio: http://localhost:3003\n');

  process.exit(allPassed ? 0 : 1);
}

// Run tests
runAllTests().catch(error => {
  console.error('\n💥 Test runner crashed:', error);
  process.exit(1);
});
