/**
 * Debug script to understand BrowserPool
 */

import { BrowserPool } from './src/modules/browserPoolManager.js';

async function debugBrowserPool() {
  console.log('🔍 Debugging BrowserPool behavior\n');

  const browserPool = new BrowserPool(1);
  await browserPool.initialize();

  try {
    // Get browser using acquireBrowser
    const result = await browserPool.acquireBrowser();
    console.log('acquireBrowser() returned:', result);
    console.log('Keys:', Object.keys(result));
    console.log('Browser type:', typeof result.browser);
    console.log('Browser constructor:', result.browser.constructor.name);

    // Try to use the browser
    const { browser, index } = result;
    console.log('\nTrying to create context...');

    try {
      const context = await browser.newContext();
      console.log('✅ Context created successfully');
      await context.close();
    } catch (error) {
      console.error('❌ Failed to create context:', error.message);
    }

    // Release the browser
    await browserPool.releaseBrowser(index);

  } finally {
    await browserPool.cleanup();
  }
}

debugBrowserPool().catch(console.error);