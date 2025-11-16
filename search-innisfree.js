import supabase from './src/utils/supabase.js';

async function searchInnisfree() {
  console.log('\nSearching for properties with innisfree...\n');
  
  const { data: properties, error } = await supabase
    .from('properties')
    .select('*')
    .ilike('name', '%innisfree%');
    
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  if (!properties || properties.length === 0) {
    console.log('No innisfree properties found');
    return;
  }
  
  console.log(`Found ${properties.length} property/properties:\n`);
  
  properties.forEach(p => {
    console.log('---');
    console.log('ID:', p.id);
    console.log('Name:', p.name);
    console.log('Slug:', p.slug);
    console.log('URL:', p.url);
    console.log('GA4:', p.measurement_id);
    console.log('GTM:', p.gtm_id);
    console.log('Consent Mode:', p.has_consent_mode);
  });
}

searchInnisfree().catch(console.error);
