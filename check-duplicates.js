/**
 * Check duplicate property entries in specific crawl run
 */

import { supabase, Tables } from './src/utils/supabase.js';

const runId = '274d6c26-29eb-4716-989b-8ad1a24e4646';

async function checkDuplicates() {
  console.log(`\n🔍 Checking duplicates for run ID: ${runId}\n`);

  // Fetch all results for this run
  const { data: results, error } = await supabase
    .from(Tables.CRAWL_RESULTS)
    .select(`
      id,
      property_id,
      validation_status,
      has_issues,
      phase,
      created_at,
      properties (
        property_name
      )
    `)
    .eq('crawl_run_id', runId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  console.log(`Total results: ${results.length}\n`);

  // Group by property_id
  const propertyMap = new Map();

  for (const result of results) {
    const propId = result.property_id;
    const propName = result.properties?.property_name || propId;

    if (!propertyMap.has(propId)) {
      propertyMap.set(propId, []);
    }

    propertyMap.get(propId).push({
      id: result.id,
      propertyName: propName,
      phase: result.phase,
      status: result.validation_status,
      hasIssues: result.has_issues,
      createdAt: result.created_at
    });
  }

  // Find duplicates
  const duplicates = [];
  const unique = [];

  for (const [propId, entries] of propertyMap) {
    if (entries.length > 1) {
      duplicates.push({ propId, entries });
    } else {
      unique.push({ propId, entries: entries[0] });
    }
  }

  console.log(`📊 Summary:`);
  console.log(`   Unique properties: ${unique.length}`);
  console.log(`   Duplicate properties: ${duplicates.length}\n`);

  if (duplicates.length > 0) {
    console.log(`\n🔴 DUPLICATES FOUND:\n`);

    for (const { propId, entries } of duplicates) {
      console.log(`Property ID: ${propId}`);
      console.log(`Property Name: ${entries[0].propertyName}`);
      console.log(`Entries: ${entries.length}\n`);

      entries.forEach((entry, index) => {
        console.log(`  [${index + 1}] Phase ${entry.phase} - ${entry.status || 'unknown'}`);
        console.log(`      hasIssues: ${entry.hasIssues}`);
        console.log(`      Created: ${entry.createdAt}`);
        console.log(`      ID: ${entry.id}\n`);
      });
    }
  }

  // Check phase distribution
  const phase1Count = results.filter(r => r.phase === 1).length;
  const phase2Count = results.filter(r => r.phase === 2).length;

  console.log(`\n📈 Phase Distribution:`);
  console.log(`   Phase 1: ${phase1Count}`);
  console.log(`   Phase 2: ${phase2Count}`);
  console.log(`   Total: ${phase1Count + phase2Count}\n`);
}

checkDuplicates().catch(console.error);
