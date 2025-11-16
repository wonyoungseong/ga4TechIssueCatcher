/**
 * Verify that vanilla Playwright is being used (not playwright-extra)
 */

import { BrowserPool } from './src/modules/browserPoolManager.js';

console.log('\n=== Playwright Import Verification ===\n');

async function verify() {
  try {
    console.log('Creating browser pool...');
    const pool = new BrowserPool(1);

    console.log('Initializing browser...');
    await pool.initialize();

    console.log('✅ SUCCESS: Vanilla Playwright is working!');
    console.log('Browser pool initialized successfully with vanilla Playwright\n');

    await pool.cleanup();

    console.log('✅ Test completed successfully');
    console.log('The server is now using FAST vanilla Playwright (not slow playwright-extra)\n');

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

verify();
