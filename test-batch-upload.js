import { supabase, Tables } from './src/utils/supabase.js';
import fs from 'fs';
import path from 'path';

async function testBatchUpload() {
  try {
    console.log('Testing batch upload with fixed schema...\n');

    // Read a sample result from JSON
    const resultsDir = './results/2025-11-14';
    const files = fs.readdirSync(resultsDir);

    if (files.length === 0) {
      console.log('No result files found');
      return;
    }

    const sampleFile = path.join(resultsDir, files[0]);
    const sampleResult = JSON.parse(fs.readFileSync(sampleFile, 'utf8'));

    console.log('Sample result:', {
      property_name: sampleResult.property_name,
      propertyId: sampleResult.propertyId,
      has_validation_details: !!sampleResult.validation_details
    });

    //First, create a crawl run
    console.log('\n1. Creating crawl run...');
    const { data: runData, error: runError } = await supabase
      .from(Tables.CRAWL_RUNS)
      .insert({
        execution_id: 'test-run-' + Date.now(),
        start_time: new Date().toISOString(),
        total_properties: 1,
        successful: 0,
        failed: 0,
        status: 'running'
      })
      .select()
      .single();

    if (runError) {
      console.error('❌ Failed to create crawl run:', runError);
      return;
    }

    console.log('✅ Crawl run created:', runData.id);

    // Now try to insert the result
    console.log('\n2. Inserting crawl result...');
    const resultToInsert = {
      run_id: runData.id,
      property_id: sampleResult.propertyId,
      property_name: sampleResult.property_name,
      url: sampleResult.url,
      measurement_id: sampleResult.measurement_id,
      expected_id: sampleResult.expected_id,
      gtm_container_id: sampleResult.gtm_container_id,
      expected_gtm: sampleResult.expected_gtm,
      has_page_view: sampleResult.has_page_view,
      validation_status: sampleResult.validation_status,
      validation_details: sampleResult.validation_details || null,
      error_message: sampleResult.error_message,
      is_service_closed: sampleResult.is_service_closed || false,
      processing_time_ms: sampleResult.processing_time_ms
    };

    console.log('Data to insert:', JSON.stringify(resultToInsert, null, 2));

    const { data: resultData, error: resultError } = await supabase
      .from(Tables.CRAWL_RESULTS)
      .insert(resultToInsert)
      .select()
      .single();

    if (resultError) {
      console.error('❌ Failed to insert result:', resultError);
      console.error('Error details:', JSON.stringify(resultError, null, 2));
      return;
    }

    console.log('✅ Result inserted successfully:', resultData.id);

    // Cleanup
    console.log('\n3. Cleaning up test data...');
    await supabase.from(Tables.CRAWL_RESULTS).delete().eq('id', resultData.id);
    await supabase.from(Tables.CRAWL_RUNS).delete().eq('id', runData.id);
    console.log('✅ Cleanup completed');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testBatchUpload();
