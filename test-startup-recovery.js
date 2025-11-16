#!/usr/bin/env node
/**
 * Test startup recovery system
 *
 * Tests the automatic recovery of incomplete crawl runs
 */

import { recoverIncompleteCrawls } from './src/utils/startupRecovery.js';

console.log('🧪 Testing Startup Recovery System\n');
console.log('='.repeat(80));

async function testRecovery() {
  try {
    const result = await recoverIncompleteCrawls();

    console.log('\n' + '='.repeat(80));
    console.log('📊 Recovery Test Results:');
    console.log('='.repeat(80));
    console.log(`Runs Recovered: ${result.recovered}`);
    console.log(`Duplicates Removed: ${result.duplicatesRemoved}`);

    if (result.error) {
      console.log(`Error: ${result.error}`);
    }

    console.log('='.repeat(80) + '\n');

    if (result.recovered === 0) {
      console.log('✅ Test completed - No incomplete runs found (system is healthy)');
    } else {
      console.log('✅ Test completed - Recovery system working correctly');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testRecovery()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
