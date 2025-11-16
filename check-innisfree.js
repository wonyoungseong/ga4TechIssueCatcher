import supabase from './src/utils/supabase.js';

async function checkInnisfree() {
  console.log('\n=== Checking innisfree-kr ===\n');

  const { data: properties } = await supabase
    .from('properties')
    .select('*')
    .ilike('url', '%innisfree%kr%')
    .limit(1);

  if (!properties || properties.length === 0) {
    console.log('Property not found');
    return;
  }

  const property = properties[0];
  console.log('Property:', property.id, property.name, property.url);
  console.log('Has Consent Mode:', property.has_consent_mode);
  console.log('Expected GA4:', property.measurement_id);

  const { data: results } = await supabase
    .from('crawl_results')
    .select('*')
    .eq('property_id', property.id)
    .order('created_at', { ascending: false })
    .limit(1);

  if (!results || results.length === 0) {
    console.log('No crawl results found');
    return;
  }

  const result = results[0];
  console.log('\n=== Latest Crawl Result ===');
  console.log('Crawl Run ID:', result.crawl_run_id);
  console.log('Validation Status:', result.validation_status);
  console.log('Collected GA4 ID:', result.collected_ga4_id);
  console.log('Has Issues:', result.has_issues);
  console.log('Issue Types:', result.issue_types);
  console.log('Issue Summary:', result.issue_summary);

  if (result.validation_details) {
    console.log('\n=== Validation Details ===');
    console.log(JSON.stringify(result.validation_details, null, 2));
  }
}

checkInnisfree();
