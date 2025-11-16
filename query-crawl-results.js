import supabase from './src/utils/supabase.js';

async function queryResults() {
  // Query for the three URLs mentioned
  const urls = [
    'illiyoon.com',
    'innisfree.com',
    'sulwhasoo.com'
  ];

  for (const url of urls) {
    console.log(`\n=== Checking ${url} ===\n`);

    // First find property
    const { data: properties } = await supabase
      .from('properties')
      .select('*')
      .ilike('url', `%${url}%`)
      .limit(5);

    if (!properties || properties.length === 0) {
      console.log('Property not found');
      continue;
    }

    for (const property of properties) {
      console.log('\nProperty:', property.id, property.name, property.url);

      // Get latest crawl result
      const { data: results } = await supabase
        .from('crawl_results')
        .select('*')
        .eq('property_id', property.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!results || results.length === 0) {
        console.log('No crawl results found');
        continue;
      }

      const result = results[0];
      console.log('\nCrawl Result ID:', result.id);
      console.log('Created:', result.created_at);
      console.log('Is Valid:', result.is_valid);
      console.log('Severity:', result.severity);
      console.log('\nValidation Summary:', JSON.stringify(result.validation_summary, null, 2));
      if (result.debug_info) {
        console.log('\nDebug Info:', JSON.stringify(result.debug_info, null, 2));
      }
    }
  }
}

queryResults();
