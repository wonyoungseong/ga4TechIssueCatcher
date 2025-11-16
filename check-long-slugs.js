/**
 * Check for properties with excessively long slugs
 */

import { supabase, Tables } from './src/utils/supabase.js';

async function checkLongSlugs() {
  const { data: properties, error } = await supabase
    .from(Tables.PROPERTIES)
    .select('id, property_name, slug, url')
    .eq('is_active', true);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('\n📊 Slug Length Analysis:\n');

  // Find properties with slugs over 200 characters
  const longSlugs = properties.filter(p => p.slug && p.slug.length > 200);

  if (longSlugs.length === 0) {
    console.log('✅ All slugs are under 200 characters\n');
  } else {
    console.log(`⚠️ Found ${longSlugs.length} properties with slugs over 200 chars:\n`);

    longSlugs.forEach((prop, index) => {
      console.log(`${index + 1}. ${prop.property_name}`);
      console.log(`   Slug length: ${prop.slug.length} characters`);
      console.log(`   Slug: ${prop.slug.substring(0, 100)}...`);
      console.log(`   URL: ${prop.url.substring(0, 100)}...\n`);
    });

    console.log('\n💡 These slugs should be truncated to 200 characters.');
    console.log('   Run: node fix-long-slugs.js\n');
  }

  // Show distribution
  const slugLengths = properties.map(p => p.slug ? p.slug.length : 0).sort((a, b) => b - a);
  console.log('Slug Length Distribution:');
  console.log(`  Max: ${slugLengths[0]} chars`);
  console.log(`  Average: ${Math.round(slugLengths.reduce((a, b) => a + b, 0) / slugLengths.length)} chars`);
  console.log(`  Min: ${slugLengths[slugLengths.length - 1]} chars\n`);
}

checkLongSlugs().catch(console.error);
