/**
 * Analyze page_view event timing from validation results
 */

import fs from 'fs';
import path from 'path';

const RESULTS_DIR = './results/2025-10-30';

const timings = [];

// Read all result files
const files = fs.readdirSync(RESULTS_DIR)
  .filter(f => f.endsWith('.json') && f !== '_summary.json');

for (const file of files) {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, file), 'utf-8'));

    if (data.pageViewEvent) {
      timings.push({
        property: data.propertyName,
        detectionTimeMs: data.pageViewEvent.detectionTimeMs,
        timedOut: data.pageViewEvent.timedOut || false,
        isValid: data.pageViewEvent.isValid,
        count: data.pageViewEvent.count || 0
      });
    }
  } catch (error) {
    // Skip files with errors
  }
}

// Sort by detection time
timings.sort((a, b) => {
  if (a.detectionTimeMs === null) return 1;
  if (b.detectionTimeMs === null) return -1;
  return a.detectionTimeMs - b.detectionTimeMs;
});

console.log('\n📊 Page View Event Timing Analysis\n');
console.log(`Total properties analyzed: ${timings.length}`);

const validTimings = timings.filter(t => t.detectionTimeMs !== null);
const noDetection = timings.filter(t => t.detectionTimeMs === null);

console.log(`✅ Events detected: ${validTimings.length}`);
console.log(`❌ No detection: ${noDetection.length}`);

if (validTimings.length > 0) {
  const times = validTimings.map(t => t.detectionTimeMs);
  const min = Math.min(...times);
  const max = Math.max(...times);
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const median = times.sort((a, b) => a - b)[Math.floor(times.length / 2)];

  console.log('\n⏱️  Timing Statistics:');
  console.log(`   Min: ${min}ms (${(min/1000).toFixed(2)}s)`);
  console.log(`   Max: ${max}ms (${(max/1000).toFixed(2)}s)`);
  console.log(`   Avg: ${avg.toFixed(0)}ms (${(avg/1000).toFixed(2)}s)`);
  console.log(`   Median: ${median}ms (${(median/1000).toFixed(2)}s)`);

  // Distribution
  const under1s = times.filter(t => t < 1000).length;
  const under3s = times.filter(t => t >= 1000 && t < 3000).length;
  const under5s = times.filter(t => t >= 3000 && t < 5000).length;
  const under10s = times.filter(t => t >= 5000 && t < 10000).length;
  const over10s = times.filter(t => t >= 10000).length;

  console.log('\n📈 Distribution:');
  console.log(`   < 1s: ${under1s} (${(under1s/validTimings.length*100).toFixed(1)}%)`);
  console.log(`   1-3s: ${under3s} (${(under3s/validTimings.length*100).toFixed(1)}%)`);
  console.log(`   3-5s: ${under5s} (${(under5s/validTimings.length*100).toFixed(1)}%)`);
  console.log(`   5-10s: ${under10s} (${(under10s/validTimings.length*100).toFixed(1)}%)`);
  console.log(`   > 10s: ${over10s} (${(over10s/validTimings.length*100).toFixed(1)}%)`);

  // Top 10 fastest
  console.log('\n🚀 Top 10 Fastest:');
  validTimings.slice(0, 10).forEach((t, i) => {
    console.log(`   ${i+1}. ${t.property}: ${t.detectionTimeMs}ms`);
  });

  // Top 10 slowest
  console.log('\n🐌 Top 10 Slowest:');
  validTimings.slice(-10).reverse().forEach((t, i) => {
    console.log(`   ${i+1}. ${t.property}: ${t.detectionTimeMs}ms`);
  });
}

console.log('\n');
