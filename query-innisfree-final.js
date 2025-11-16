import supabase from './src/utils/supabase.js';

async function queryInnisfree() {
  const runId = 'df0ecced-6f72-4412-9790-f67ff3726528';
  
  console.log('\n=== Querying INNISFREE - KR from run', runId, '===\n');
  
  const { data: property } = await supabase
    .from('properties')
    .select('*')
    .eq('slug', 'innisfree-com-kr-ko-f6ad4f49')
    .single();
    
  if (!property) {
    console.log('Property not found');
    return;
  }
  
  console.log('Property Info:');
  console.log('  Name:', property.property_name);
  console.log('  URL:', property.url);
  console.log('  Expected GA4:', property.expected_ga4_id);
  console.log('  Expected GTM:', property.expected_gtm_id);
  console.log('  Has Consent Mode:', property.has_consent_mode);
  
  const { data: result, error } = await supabase
    .from('crawl_results')
    .select('*, status:validation_status')
    .eq('crawl_run_id', runId)
    .eq('property_id', property.id)
    .single();
    
  if (error) {
    console.log('\nError:', error);
    return;
  }
  
  if (!result) {
    console.log('\nNo result found');
    return;
  }
  
  console.log('\nCrawl Result:');
  console.log('  Status:', result.status);
  console.log('  Collected GA4:', result.collected_ga4_id);
  console.log('  page_view detected:', result.page_view_event_detected);
  console.log('  Has Issues:', result.has_issues);
  console.log('  Issue Types:', result.issue_types);
  console.log('  Issue Summary:', result.issue_summary);
  
  if (result.validation_details) {
    console.log('\nValidation Details:');
    console.log(JSON.stringify(result.validation_details, null, 2));
  }
  
  if (result.raw_data) {
    const rawData = typeof result.raw_data === 'string' 
      ? JSON.parse(result.raw_data) 
      : result.raw_data;
      
    console.log('\nRaw Data Analysis:');
    console.log('  Is Valid:', rawData.isValid);
    
    if (rawData.measurementId) {
      console.log('\n  === Measurement ID Validation ===');
      console.log('    Is Valid:', rawData.measurementId.isValid);
      console.log('    Expected:', rawData.measurementId.expected);
      console.log('    Actual:', rawData.measurementId.actual);
      console.log('    All Found:', rawData.measurementId.allFound);
      
      if (rawData.measurementId.extractionSource) {
        console.log('\n    Extraction Source:');
        console.log(JSON.stringify(rawData.measurementId.extractionSource, null, 2));
      }
      
      if (rawData.measurementId.issues) {
        console.log('\n    Measurement ID Issues:');
        rawData.measurementId.issues.forEach((issue, i) => {
          console.log(`      ${i+1}.`, JSON.stringify(issue, null, 2));
        });
      }
    }
    
    if (rawData.pageViewEvent) {
      console.log('\n  === Page View Event ===');
      console.log('    Is Valid:', rawData.pageViewEvent.isValid);
      console.log('    Count:', rawData.pageViewEvent.count);
      console.log('    Timed Out:', rawData.pageViewEvent.timedOut);
    }
    
    if (rawData.issues && rawData.issues.length > 0) {
      console.log('\n  === ALL Issues ===');
      rawData.issues.forEach((issue, i) => {
        console.log(`    ${i+1}.`);
        console.log('       Type:', issue.type);
        console.log('       Severity:', issue.severity);
        console.log('       Message:', issue.message);
        if (issue.indicators) {
          console.log('       Indicators:', issue.indicators);
        }
      });
    }
  }
}

queryInnisfree().catch(console.error);
