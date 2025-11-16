#!/usr/bin/env node

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('\n🔍 Checking available properties in Supabase...\n');

const { data, error } = await supabase
  .from('properties')
  .select('*')
  .limit(5);

if (error) {
  console.error('❌ Error:', error);
} else {
  console.log('✅ Available properties:');
  data.forEach(p => console.log(`  - ${p.id}: ${p.name} (${p.slug})`));
  console.log(`\n📊 Total: ${data.length} properties found\n`);
}
