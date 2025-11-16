#!/usr/bin/env node

/**
 * Setup Verification Script
 * Checks if all required components are properly installed and configured
 */

import fs from 'fs/promises';
import { chromium } from 'playwright';

const checks = [];

async function verify() {
  console.log('🔍 Verifying GA4 Tech Issue Catcher Setup\n');
  console.log('='.repeat(60));

  // Check 1: Node.js version
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));
  checks.push({
    name: 'Node.js Version',
    passed: majorVersion >= 18,
    message: `${nodeVersion} ${majorVersion >= 18 ? '✅' : '❌ (Requires 18+)'}`
  });

  // Check 2: Required files exist
  const requiredFiles = [
    'package.json',
    '.env',
    '.env.example',
    'src/index.js',
    'src/modules/csvPropertyManager.js',
    'src/modules/browserPoolManager.js',
    'src/modules/networkEventCapturer.js',
    'src/modules/configValidator.js',
    'src/modules/resultStorage.js',
    'src/modules/orchestrator.js',
    'src/ga4Property/Amore_GA4_PropertList.csv'
  ];

  for (const file of requiredFiles) {
    try {
      await fs.access(file);
      checks.push({
        name: `File: ${file}`,
        passed: true,
        message: '✅'
      });
    } catch (error) {
      checks.push({
        name: `File: ${file}`,
        passed: false,
        message: '❌ Missing'
      });
    }
  }

  // Check 3: Required directories exist
  const requiredDirs = ['results', 'screenshots', 'logs'];
  for (const dir of requiredDirs) {
    try {
      await fs.access(dir);
      checks.push({
        name: `Directory: ${dir}`,
        passed: true,
        message: '✅'
      });
    } catch (error) {
      checks.push({
        name: `Directory: ${dir}`,
        passed: false,
        message: '❌ Missing'
      });
    }
  }

  // Check 4: Playwright browser installed
  try {
    const browser = await chromium.launch({ headless: true });
    await browser.close();
    checks.push({
      name: 'Playwright Chromium',
      passed: true,
      message: '✅ Installed'
    });
  } catch (error) {
    checks.push({
      name: 'Playwright Chromium',
      passed: false,
      message: '❌ Not installed (run: npx playwright install chromium)'
    });
  }

  // Display results
  console.log('\n📋 Verification Results:\n');
  checks.forEach(check => {
    console.log(`${check.message.padEnd(10)} ${check.name}`);
  });

  const passedCount = checks.filter(c => c.passed).length;
  const totalCount = checks.length;

  console.log('\n' + '='.repeat(60));
  console.log(`\n✅ Passed: ${passedCount}/${totalCount}`);

  if (passedCount === totalCount) {
    console.log('\n🎉 All checks passed! System is ready to run.');
    console.log('\nNext steps:');
    console.log('  1. Configure Slack webhook in .env (optional)');
    console.log('  2. Run: npm start');
    console.log('  3. Check results in: results/ and screenshots/\n');
  } else {
    console.log('\n⚠️ Some checks failed. Please fix the issues above.\n');
    process.exit(1);
  }
}

verify().catch(error => {
  console.error('Verification failed:', error);
  process.exit(1);
});
