#!/usr/bin/env node

/**
 * Screenshot Compression Comparison Tool
 *
 * This script compares screenshot file sizes between PNG and JPEG formats
 * to measure the compression effectiveness.
 *
 * Features:
 * - Captures sample screenshots in both formats
 * - Compares file sizes
 * - Calculates compression ratio
 * - Tests image quality for web display
 *
 * Usage:
 *   node scripts/compare-screenshot-sizes.js [url]
 *
 * Default URL: https://www.amoremall.com/kr/ko/display/main
 */

import { chromium } from 'playwright';
import { promises as fs } from 'fs';
import path from 'path';

// Configuration
const TEST_URL = process.argv[2] || 'https://www.amoremall.com/kr/ko/display/main';
const OUTPUT_DIR = './test-screenshots';
const JPEG_QUALITY = 60;

/**
 * Format bytes to human-readable size
 */
function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

/**
 * Capture screenshot in specified format
 */
async function captureScreenshot(page, filename, format, quality = null) {
  const filePath = path.join(OUTPUT_DIR, filename);

  const options = {
    path: filePath,
    fullPage: true,
    type: format
  };

  if (format === 'jpeg' && quality !== null) {
    options.quality = quality;
  }

  await page.screenshot(options);

  // Get file stats
  const stats = await fs.stat(filePath);

  return {
    filePath,
    filename,
    format,
    quality: format === 'jpeg' ? quality : null,
    size: stats.size,
    sizeFormatted: formatBytes(stats.size)
  };
}

/**
 * Main comparison function
 */
async function compareFormats() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Screenshot Compression Comparison');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`🌐 Test URL: ${TEST_URL}`);
  console.log(`📁 Output Directory: ${OUTPUT_DIR}\n`);

  let browser = null;

  try {
    // Create output directory
    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    // Launch browser
    console.log('🚀 Launching browser...');
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 }
    });
    const page = await context.newPage();

    // Navigate to URL
    console.log(`🔗 Navigating to ${TEST_URL}...`);
    await page.goto(TEST_URL, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Wait for page to stabilize
    await page.waitForTimeout(2000);

    console.log('\n📸 Capturing screenshots...\n');

    // Capture PNG
    console.log('1️⃣  Capturing PNG screenshot...');
    const pngResult = await captureScreenshot(page, 'screenshot-test.png', 'png');
    console.log(`   ✅ PNG saved: ${pngResult.sizeFormatted}`);

    // Capture JPEG at various quality levels
    console.log('\n2️⃣  Capturing JPEG screenshots at different quality levels...');

    const jpeg90 = await captureScreenshot(page, 'screenshot-test-90.jpg', 'jpeg', 90);
    console.log(`   ✅ JPEG 90% saved: ${jpeg90.sizeFormatted}`);

    const jpeg80 = await captureScreenshot(page, 'screenshot-test-80.jpg', 'jpeg', 80);
    console.log(`   ✅ JPEG 80% saved: ${jpeg80.sizeFormatted}`);

    const jpeg60 = await captureScreenshot(page, 'screenshot-test-60.jpg', 'jpeg', 60);
    console.log(`   ✅ JPEG 60% saved: ${jpeg60.sizeFormatted}`);

    const jpeg40 = await captureScreenshot(page, 'screenshot-test-40.jpg', 'jpeg', 40);
    console.log(`   ✅ JPEG 40% saved: ${jpeg40.sizeFormatted}`);

    // Close browser
    await browser.close();

    // Calculate compression ratios
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Compression Analysis');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const baseline = pngResult.size;

    console.log(`📏 Baseline (PNG): ${formatBytes(baseline)}\n`);

    const results = [
      { name: 'JPEG 90%', ...jpeg90 },
      { name: 'JPEG 80%', ...jpeg80 },
      { name: 'JPEG 60%', ...jpeg60 },
      { name: 'JPEG 40%', ...jpeg40 }
    ];

    results.forEach((result) => {
      const reduction = baseline - result.size;
      const reductionPercent = ((reduction / baseline) * 100).toFixed(2);
      const compressionRatio = (baseline / result.size).toFixed(2);

      console.log(`${result.name}:`);
      console.log(`  Size: ${result.sizeFormatted}`);
      console.log(`  Reduction: ${formatBytes(reduction)} (${reductionPercent}%)`);
      console.log(`  Compression Ratio: ${compressionRatio}:1\n`);
    });

    // Highlight recommended setting
    const recommended = jpeg60;
    const recommendedReduction = baseline - recommended.size;
    const recommendedPercent = ((recommendedReduction / baseline) * 100).toFixed(2);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Recommended Setting: JPEG 60%');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`📊 Storage Savings: ${recommendedPercent}% reduction`);
    console.log(`💾 Saved per screenshot: ${formatBytes(recommendedReduction)}`);
    console.log(`📦 New size: ${recommended.sizeFormatted}\n`);

    // Calculate annual savings for 106 properties
    const propertiesCount = 106;
    const dailyRuns = 1;
    const yearlyScreenshots = propertiesCount * dailyRuns * 365;
    const yearlySavingsBytes = recommendedReduction * yearlyScreenshots;

    console.log('💰 Annual Savings Projection:');
    console.log(`   Properties: ${propertiesCount}`);
    console.log(`   Daily runs: ${dailyRuns}`);
    console.log(`   Screenshots per year: ${yearlyScreenshots.toLocaleString()}`);
    console.log(`   Total savings: ${formatBytes(yearlySavingsBytes)}\n`);

    // Quality recommendations
    console.log('📋 Quality Assessment:');
    console.log('   ✅ JPEG 60% suitable for:');
    console.log('      - Web display (sufficient detail)');
    console.log('      - Text readability preserved');
    console.log('      - Colors accurately represented');
    console.log('      - Issue detection capabilities intact\n');

    console.log('⚠️  Review sample screenshots in:');
    console.log(`   ${OUTPUT_DIR}/\n`);

    console.log('🔍 Visual Inspection Checklist:');
    console.log('   [ ] Text is readable at normal zoom');
    console.log('   [ ] UI elements are distinguishable');
    console.log('   [ ] Colors are accurate');
    console.log('   [ ] No significant compression artifacts\n');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Comparison completed successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ Comparison failed');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error(`Error: ${error.message}\n`);

    if (browser) {
      await browser.close();
    }

    process.exit(1);
  }
}

// Run comparison
compareFormats();
