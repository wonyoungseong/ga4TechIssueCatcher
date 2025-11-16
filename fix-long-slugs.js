/**
 * Fix properties with excessively long slugs by truncating to 200 chars
 */

import { supabase, Tables } from './src/utils/supabase.js';

async function fixLongSlugs() {
  console.log('\n🔧 Fixing long slugs...\n');

  // Get properties with slugs over 200 characters
  const { data: properties, error: fetchError } = await supabase
    .from(Tables.PROPERTIES)
    .select('id, property_name, slug, url')
    .eq('is_active', true);

  if (fetchError) {
    console.error('❌ Error fetching properties:', fetchError);
    return;
  }

  const longSlugs = properties.filter(p => p.slug && p.slug.length > 200);

  if (longSlugs.length === 0) {
    console.log('✅ No slugs need fixing!\n');
    return;
  }

  console.log(`Found ${longSlugs.length} properties with long slugs:\n`);

  for (const prop of longSlugs) {
    const oldSlug = prop.slug;
    const newSlug = oldSlug.substring(0, 200);

    console.log(`📝 ${prop.property_name}`);
    console.log(`   Old length: ${oldSlug.length} chars`);
    console.log(`   New length: ${newSlug.length} chars`);
    console.log(`   Old slug: ${oldSlug.substring(0, 100)}...`);
    console.log(`   New slug: ${newSlug.substring(0, 100)}...`);

    // Update in database
    const { error: updateError } = await supabase
      .from(Tables.PROPERTIES)
      .update({ slug: newSlug })
      .eq('id', prop.id);

    if (updateError) {
      console.error(`   ❌ Failed to update: ${updateError.message}\n`);
    } else {
      console.log(`   ✅ Updated successfully\n`);
    }
  }

  console.log('✅ All long slugs have been fixed!\n');
}

fixLongSlugs().catch(console.error);
