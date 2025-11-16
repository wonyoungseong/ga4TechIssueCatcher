import supabase from './src/utils/supabase.js';

async function searchAndCheck() {
  const runId = 'df0ecced-6f72-4412-9790-f67ff3726528';
  
  console.log('\n=== Searching for innisfree properties ===\n');
  
  const { data: properties, error: propError } = await supabase
    .from('properties')
    .select('*')
    .ilike('property_name', '%innisfree%');
    
  if (propError) {
    console.error('Error:', propError);
    return;
  }
  
  if (!properties || properties.length === 0) {
    console.log('No innisfree properties found');
    return;
  }
  
  console.log(`Found ${properties.length} property/properties:\n`);
  
  for (const prop of properties) {
    console.log('---');
    console.log('Property Name:', prop.property_name);
    console.log('Slug:', prop.slug);
    console.log('URL:', prop.url);
    console.log('Expected GA4:', prop.expected_ga4_id);
    console.log('Expected GTM:', prop.expected_gtm_id);
    console.log('Has Consent Mode:', prop.has_consent_mode);
    
    const { data: results, error: resultError } = await supabase
      .from('crawl_results')
      .select('*')
      .eq('run_id', runId)
      .eq('property_id', prop.id);
      
    if (resultError) {
      console.error('Error getting results:', resultError);
      continue;
    }
    
    if (!results || results.length === 0) {
      console.log('No crawl result for this run');
      continue;
    }
    
    const result = results[0];
    console.log('\nCrawl Result:');
    console.log('  Status:', result.status);
    console.log('  Collected GA4:', result.collected_ga4_id);
    console.log('  page_view:', result.page_view_event_detected);
    console.log('  Issue Types:', result.issue_types);
    
    if (result.validation_details) {
      console.log('\n  Validation Details:');
      console.log(JSON.stringify(result.validation_details, null, 2));
    }
    
    if (result.raw_data) {
      const rawData = typeof result.raw_data === 'string' 
        ? JSON.parse(result.raw_data) 
        : result.raw_data;
        
      console.log('\n  Is Valid:', rawData.isValid);
      
      if (rawData.measurementId) {
        console.log('\n  Measurement ID Validation:');
        console.log('    Is Valid:', rawData.measurementId.isValid);
        console.log('    Expected:', rawData.measurementId.expected);
        console.log('    Actual:', rawData.measurementId.actual);
        console.log('    All Found:', rawData.measurementId.allFound);
        
        if (rawData.measurementId.extractionSource) {
          console.log('\n    Extraction Source:');
          console.log(JSON.stringify(rawData.measurementId.extractionSource, null, 2));
        }
      }
      
      if (rawData.issues && rawData.issues.length > 0) {
        console.log('\n  Issues:');
        rawData.issues.forEach((issue, i) => {
          console.log(`    ${i+1}.`, JSON.stringify(issue, null, 2));
        });
      }
    }
  }
}

searchAndCheck().catch(console.error);
