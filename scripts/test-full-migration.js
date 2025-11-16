#!/usr/bin/env node

/**
 * Full Migration Test Orchestrator
 *
 * This script orchestrates all migration-related tests in sequence and generates
 * a comprehensive test report. It validates the complete local Supabase migration
 * including database, storage, screenshots, and end-to-end workflow.
 *
 * Test Suite:
 * 1. Connection Test - Validates local Supabase connectivity
 * 2. Screenshot Comparison - Measures JPEG compression effectiveness
 * 3. End-to-End Test - Validates complete workflow
 *
 * Features:
 * - Sequential test execution with dependency checks
 * - Comprehensive HTML and JSON reports
 * - Color-coded console output
 * - Detailed failure analysis
 * - Test timing and performance metrics
 *
 * Usage:
 *   node scripts/test-full-migration.js
 *   npm run test:full-migration
 *
 * Prerequisites:
 *   - Local Supabase running: docker-compose up -d
 *   - Environment configured: ./scripts/switch-to-local.sh
 *   - Properties imported: node scripts/import-properties-to-local.js
 */

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

// Test configuration
const TESTS = [
  {
    id: 'connection',
    name: 'Connection Test',
    description: 'Validates local Supabase connectivity',
    script: 'scripts/test-local-connection.js',
    required: true,
    timeout: 60000 // 60 seconds
  },
  {
    id: 'compression',
    name: 'Screenshot Compression',
    description: 'Measures JPEG compression effectiveness',
    script: 'scripts/compare-screenshot-sizes.js',
    required: false,
    timeout: 120000 // 120 seconds
  },
  {
    id: 'e2e',
    name: 'End-to-End Test',
    description: 'Validates complete validation workflow',
    script: 'scripts/test-e2e-local.js',
    required: true,
    timeout: 180000 // 180 seconds
  }
];

// Output configuration
const REPORT_DIR = './test-reports';
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

/**
 * Print colored message
 */
function printColor(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Format duration in human-readable format
 */
function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${((ms % 60000) / 1000).toFixed(0)}s`;
}

/**
 * Run a single test script
 */
async function runTest(test) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let stdout = '';
    let stderr = '';

    printColor('cyan', `\n${'═'.repeat(60)}`);
    printColor('bright', `🧪 Running: ${test.name}`);
    printColor('cyan', `${'═'.repeat(60)}`);
    console.log(`Description: ${test.description}`);
    console.log(`Script: ${test.script}`);
    console.log(`Timeout: ${formatDuration(test.timeout)}\n`);

    const child = spawn('node', [test.script], {
      stdio: 'pipe',
      timeout: test.timeout
    });

    // Capture stdout
    child.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      process.stdout.write(output); // Echo to console
    });

    // Capture stderr
    child.stderr.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      process.stderr.write(output); // Echo to console
    });

    // Handle completion
    child.on('close', (code) => {
      const duration = Date.now() - startTime;
      const success = code === 0;

      const result = {
        id: test.id,
        name: test.name,
        description: test.description,
        success,
        exitCode: code,
        duration,
        stdout,
        stderr,
        timestamp: new Date().toISOString()
      };

      printColor('cyan', `\n${'─'.repeat(60)}`);
      if (success) {
        printColor('green', `✅ ${test.name} passed (${formatDuration(duration)})`);
      } else {
        printColor('red', `❌ ${test.name} failed (${formatDuration(duration)})`);
        if (test.required) {
          printColor('red', '   ⚠️  This is a required test - subsequent tests may fail');
        }
      }
      printColor('cyan', `${'─'.repeat(60)}`);

      resolve(result);
    });

    // Handle timeout
    child.on('error', (error) => {
      const duration = Date.now() - startTime;

      const result = {
        id: test.id,
        name: test.name,
        description: test.description,
        success: false,
        exitCode: -1,
        duration,
        stdout,
        stderr: stderr + `\nError: ${error.message}`,
        timestamp: new Date().toISOString()
      };

      printColor('red', `\n❌ ${test.name} error: ${error.message}`);
      resolve(result);
    });
  });
}

/**
 * Generate HTML report
 */
async function generateHTMLReport(results, summary) {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Migration Test Report - ${summary.timestamp}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f5f5f5;
            padding: 20px;
        }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        h1 { color: #2c3e50; margin-bottom: 10px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 30px 0; }
        .summary-card { padding: 20px; border-radius: 8px; text-align: center; }
        .summary-card.passed { background: #d4edda; border: 2px solid #28a745; }
        .summary-card.failed { background: #f8d7da; border: 2px solid #dc3545; }
        .summary-card h3 { font-size: 14px; color: #666; margin-bottom: 10px; }
        .summary-card .value { font-size: 32px; font-weight: bold; }
        .test-result { margin: 30px 0; padding: 20px; border-radius: 8px; border-left: 4px solid #ccc; }
        .test-result.passed { border-left-color: #28a745; background: #f8fff9; }
        .test-result.failed { border-left-color: #dc3545; background: #fff8f8; }
        .test-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
        .test-header h2 { color: #2c3e50; font-size: 20px; }
        .badge { padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: bold; }
        .badge.passed { background: #28a745; color: white; }
        .badge.failed { background: #dc3545; color: white; }
        .test-meta { color: #666; font-size: 14px; margin-bottom: 10px; }
        .output-section { margin-top: 15px; }
        .output-section h4 { color: #555; margin-bottom: 10px; }
        .output { background: #f8f9fa; padding: 15px; border-radius: 4px; font-family: 'Monaco', 'Courier New', monospace; font-size: 12px; overflow-x: auto; white-space: pre-wrap; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🧪 Migration Test Report</h1>
        <p style="color: #666; margin-bottom: 30px;">Generated: ${summary.timestamp}</p>

        <div class="summary">
            <div class="summary-card ${summary.allPassed ? 'passed' : 'failed'}">
                <h3>Overall Status</h3>
                <div class="value">${summary.allPassed ? '✅ PASS' : '❌ FAIL'}</div>
            </div>
            <div class="summary-card">
                <h3>Tests Passed</h3>
                <div class="value" style="color: #28a745;">${summary.passed}</div>
            </div>
            <div class="summary-card">
                <h3>Tests Failed</h3>
                <div class="value" style="color: #dc3545;">${summary.failed}</div>
            </div>
            <div class="summary-card">
                <h3>Total Duration</h3>
                <div class="value" style="color: #007bff; font-size: 24px;">${formatDuration(summary.totalDuration)}</div>
            </div>
        </div>

        ${results.map(result => `
            <div class="test-result ${result.success ? 'passed' : 'failed'}">
                <div class="test-header">
                    <h2>${result.name}</h2>
                    <span class="badge ${result.success ? 'passed' : 'failed'}">
                        ${result.success ? 'PASSED' : 'FAILED'}
                    </span>
                </div>
                <div class="test-meta">
                    <strong>Description:</strong> ${result.description}<br>
                    <strong>Duration:</strong> ${formatDuration(result.duration)}<br>
                    <strong>Exit Code:</strong> ${result.exitCode}
                </div>
                ${result.stdout ? `
                    <div class="output-section">
                        <h4>Console Output:</h4>
                        <div class="output">${result.stdout.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
                    </div>
                ` : ''}
                ${result.stderr ? `
                    <div class="output-section">
                        <h4>Errors:</h4>
                        <div class="output" style="color: #dc3545;">${result.stderr.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
                    </div>
                ` : ''}
            </div>
        `).join('')}

        <div class="footer">
            <p>GA4 Tech Issue Catcher - Migration Test Suite</p>
            <p>Local Supabase Setup Validation</p>
        </div>
    </div>
</body>
</html>
  `.trim();

  return html;
}

/**
 * Save test report
 */
async function saveReport(results, summary) {
  try {
    // Create report directory
    await fs.mkdir(REPORT_DIR, { recursive: true });

    // Generate filenames
    const jsonFile = path.join(REPORT_DIR, `migration-test-${TIMESTAMP}.json`);
    const htmlFile = path.join(REPORT_DIR, `migration-test-${TIMESTAMP}.html`);
    const latestHtmlFile = path.join(REPORT_DIR, 'migration-test-latest.html');

    // Save JSON report
    const jsonReport = {
      summary,
      results,
      tests: TESTS.map(t => ({ id: t.id, name: t.name, description: t.description, required: t.required }))
    };

    await fs.writeFile(jsonFile, JSON.stringify(jsonReport, null, 2), 'utf-8');
    printColor('green', `\n📄 JSON report saved: ${jsonFile}`);

    // Generate and save HTML report
    const html = await generateHTMLReport(results, summary);
    await fs.writeFile(htmlFile, html, 'utf-8');
    await fs.writeFile(latestHtmlFile, html, 'utf-8'); // Also save as latest

    printColor('green', `📊 HTML report saved: ${htmlFile}`);
    printColor('green', `📊 HTML report saved: ${latestHtmlFile}`);

  } catch (error) {
    printColor('red', `\n❌ Failed to save report: ${error.message}`);
  }
}

/**
 * Main test orchestrator
 */
async function runFullMigrationTest() {
  const startTime = Date.now();

  printColor('bright', '\n' + '═'.repeat(60));
  printColor('bright', '🧪 Full Migration Test Suite');
  printColor('bright', '═'.repeat(60));
  console.log('\nThis test suite validates the complete local Supabase migration:');
  console.log('  1. Connection Test - Database, Storage, Auth validation');
  console.log('  2. Screenshot Compression - JPEG compression effectiveness');
  console.log('  3. End-to-End Test - Complete validation workflow\n');

  const results = [];

  // Run tests sequentially
  for (const test of TESTS) {
    const result = await runTest(test);
    results.push(result);

    // Stop if required test fails
    if (!result.success && test.required) {
      printColor('red', '\n⚠️  Required test failed - stopping test suite');
      break;
    }
  }

  const totalDuration = Date.now() - startTime;

  // Calculate summary
  const summary = {
    timestamp: new Date().toISOString(),
    totalTests: results.length,
    passed: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    allPassed: results.every(r => r.success),
    totalDuration
  };

  // Print summary
  printColor('bright', '\n' + '═'.repeat(60));
  printColor('bright', '📊 Test Suite Summary');
  printColor('bright', '═'.repeat(60));

  console.log(`\nTotal Tests: ${summary.totalTests}`);
  printColor('green', `Passed: ${summary.passed}`);
  printColor('red', `Failed: ${summary.failed}`);
  console.log(`Duration: ${formatDuration(summary.totalDuration)}\n`);

  results.forEach(result => {
    const icon = result.success ? '✅' : '❌';
    const color = result.success ? 'green' : 'red';
    printColor(color, `${icon} ${result.name} (${formatDuration(result.duration)})`);
  });

  printColor('bright', '\n' + '═'.repeat(60));

  if (summary.allPassed) {
    printColor('green', '✅ All tests passed! Local Supabase migration is successful.');
  } else {
    printColor('red', '❌ Some tests failed. Please review the test output above.');
  }

  printColor('bright', '═'.repeat(60));

  // Save report
  await saveReport(results, summary);

  // Exit with appropriate code
  process.exit(summary.allPassed ? 0 : 1);
}

// Run full test suite
runFullMigrationTest().catch(error => {
  printColor('red', `\n💥 Test suite crashed: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
});
