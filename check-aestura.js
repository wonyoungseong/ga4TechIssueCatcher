import supabase from './src/utils/supabase.js';

async function checkAestura() {
  console.log('\n=== Checking fr.aestura.com ===\n');

  const { data: properties } = await supabase
    .from('properties')
    .select('*')
    .ilike('url', '%fr.aestura.com%')
    .limit(1);

  if (!properties || properties.length === 0) {
    console.log('Property not found');
    return;
  }

  const property = properties[0];
  console.log('Property:', property.id, property.name, property.url);

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
  console.log('Is Valid:', result.is_valid);
  console.log('Severity:', result.severity);
  console.log('\n=== Validation Summary ===');
  console.log(JSON.stringify(result.validation_summary, null, 2));
  
  if (result.validation_details) {
    console.log('\n=== Validation Details ===');
    console.log(JSON.stringify(result.validation_details, null, 2));
  }
}

checkAestura();
