import supabase from './src/utils/supabase.js';

async function checkInnisfreeKR() {
  const runId = 'df0ecced-6f72-4412-9790-f67ff3726528';
  
  console.log(`\nSearching for innisfree-kr in run: ${runId}\n`);
  
  const { data: property } = await supabase
    .from('properties')
    .select('*')
    .eq('slug', 'innisfree-kr')
    .single();
    
  if (!property) {
    console.log('Property innisfree-kr not found');
    return;
  }
  
  console.log('Property Info:');
  console.log('   Name:', property.name);
  console.log('   URL:', property.url);
  console.log('   Expected GA4:', property.measurement_id);
  console.log('   Expected GTM:', property.gtm_id);
  console.log('   Has Consent Mode:', property.has_consent_mode);
  
  const { data: result, error } = await supabase
    .from('crawl_results')
    .select('*')
    .eq('run_id', runId)
    .eq('property_id', property.id)
    .single();
    
  if (error || !result) {
    console.log('\nCrawl result not found');
    console.error(error);
    return;
  }
  
  console.log('\nCrawl Result:');
  console.log('   Status:', result.status);
  console.log('   Collected GA4 ID:', result.collected_ga4_id);
  console.log('   page_view detected:', result.page_view_event_detected);
  console.log('   Issue Types:', result.issue_types);
  
  if (result.validation_details) {
    console.log('\nValidation Details:');
    console.log(JSON.stringify(result.validation_details, null, 2));
  }
  
  if (result.raw_data) {
    const rawData = typeof result.raw_data === 'string' 
      ? JSON.parse(result.raw_data) 
      : result.raw_data;
      
    console.log('\nRaw Data - Is Valid:', rawData.isValid);
    
    if (rawData.measurementId) {
      console.log('\nMeasurement ID Validation:');
      console.log(JSON.stringify(rawData.measurementId, null, 2));
    }
    
    if (rawData.pageViewEvent) {
      console.log('\nPage View Event:');
      console.log(JSON.stringify(rawData.pageViewEvent, null, 2));
    }
    
    if (rawData.issues && rawData.issues.length > 0) {
      console.log('\nIssues:');
      rawData.issues.forEach((issue, i) => {
        console.log(JSON.stringify(issue, null, 2));
      });
    }
  }
}

checkInnisfreeKR().catch(console.error);
