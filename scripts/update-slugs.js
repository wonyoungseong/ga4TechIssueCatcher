/**
 * Update NULL slugs in properties table
 * Generates slug from property_name for properties that don't have one
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Generate slug from property name
 * Matches the logic in csvPropertyManager.js
 */
function generateSlug(propertyName) {
  return propertyName
    .toLowerCase()
    .replace(/[\[\]]/g, '') // Remove brackets
    .replace(/\s+/g, '-')   // Replace spaces with hyphens
    .replace(/[^a-z0-9\-가-힣]/g, '') // Keep only alphanumeric, hyphens, and Korean
    .replace(/-+/g, '-')    // Replace multiple hyphens with single
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

async function updateNullSlugs() {
  console.log('🔍 Updating all slugs to use property_name-based format...\n');

  // Get ALL properties (not just NULL slugs)
  const { data: allProperties, error: fetchError } = await supabase
    .from('properties')
    .select('id, property_name, slug, url, region');

  if (fetchError) {
    console.error('❌ Error fetching properties:', fetchError);
    process.exit(1);
  }

  console.log(`Found ${allProperties.length} total properties\n`);

  // Group by property_name to detect duplicates
  const nameGroups = {};
  allProperties.forEach(prop => {
    if (!nameGroups[prop.property_name]) {
      nameGroups[prop.property_name] = [];
    }
    nameGroups[prop.property_name].push(prop);
  });

  // Show sample
  console.log('📋 Sample properties to update:');
  allProperties.slice(0, 5).forEach(prop => {
    const newSlug = generateSlug(prop.property_name);
    console.log(`   ${prop.property_name}: ${prop.slug || 'NULL'} → ${newSlug}`);
  });
  console.log();

  // Update slugs
  console.log('🔄 Updating slugs...\n');
  let successCount = 0;
  let errorCount = 0;

  for (const property of allProperties) {
    // Check if this property_name has duplicates
    const duplicates = nameGroups[property.property_name];
    let newSlug;

    if (duplicates && duplicates.length > 1) {
      // Multiple properties with same name - differentiate by URL
      const urlPart = property.url
        .replace(/^https?:\/\//, '')  // Remove protocol
        .replace(/^(www\.|int\.)/, '') // Remove www. or int.
        .split('/')[0]                  // Get domain only
        .replace(/\./g, '-')            // Replace dots with hyphens
        .substring(0, 20);              // Limit length

      newSlug = `${generateSlug(property.property_name)}-${urlPart}`;
    } else {
      // Single property with this name - use simple slug
      newSlug = generateSlug(property.property_name);
    }

    const { error: updateError } = await supabase
      .from('properties')
      .update({ slug: newSlug })
      .eq('id', property.id);

    if (updateError) {
      console.error(`   ❌ Failed to update ${property.property_name}:`, updateError.message);
      errorCount++;
    } else {
      console.log(`   ✅ Updated: ${property.property_name} → ${newSlug}`);
      successCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Update Summary:');
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Failed: ${errorCount}`);
  console.log(`   📝 Total: ${allProperties.length}`);
  console.log('='.repeat(60));
}

// Run the update
updateNullSlugs()
  .then(() => {
    console.log('\n✨ Slug update completed!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
