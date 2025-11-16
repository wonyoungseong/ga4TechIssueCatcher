import supabase from './src/utils/supabase.js';

async function querySpecificResults() {
  // Check specific URLs mentioned by user
  const targetUrls = {
    'illiyoon': 'https://www.illiyoon.com/',
    'innisfree': 'https://www.innisfree.com/kr/ko/',
    'sulwhasoo_us': 'https://us.sulwhasoo.com/'
  };

  for (const [key, url] of Object.entries(targetUrls)) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Checking: ${url}`);
    console.log('='.repeat(80));

    // Find property
    const { data: property } = await supabase
      .from('properties')
      .select('*')
      .eq('url', url)
      .single();

    if (!property) {
      console.log('❌ Property not found for:', url);
      continue;
    }

    console.log(`\n✅ Property found: ${property.name} (ID: ${property.id})`);

    // Get latest crawl result with raw_data
    const { data: results } = await supabase
      .from('crawl_results')
      .select('*')
      .eq('property_id', property.id)
      .order('created_at', { ascending: false })
      .limit(1);

    if (!results || results.length === 0) {
      console.log('❌ No crawl results found');
      continue;
    }

    const result = results[0];
    console.log(`\n📊 Latest Crawl Result (ID: ${result.id})`);
    console.log(`   Created: ${result.created_at}`);
    console.log(`   Run ID: ${result.run_id}`);

    if (result.raw_data) {
      console.log(`\n📦 Raw Data:`);
      const rawData = typeof result.raw_data === 'string' ? JSON.parse(result.raw_data) : result.raw_data;

      console.log(`   Is Valid: ${rawData.isValid}`);
      console.log(`   Severity: ${rawData.severity}`);
      console.log(`   Measurement ID: ${rawData.measurementId}`);
      console.log(`   GTM ID: ${rawData.gtmId}`);

      if (rawData.validationDetails) {
        console.log(`\n📋 Validation Details:`);
        console.log(JSON.stringify(rawData.validationDetails, null, 2));
      }

      if (rawData.issues && rawData.issues.length > 0) {
        console.log(`\n⚠️  Issues Found:`);
        rawData.issues.forEach((issue, index) => {
          console.log(`   ${index + 1}. ${issue}`);
        });
      }

      if (rawData.debugInfo) {
        console.log(`\n🔍 Debug Info:`);
        console.log(JSON.stringify(rawData.debugInfo, null, 2));
      }
    } else {
      console.log('\n❌ No raw_data found in result');
    }
  }
}

querySpecificResults().catch(console.error);
