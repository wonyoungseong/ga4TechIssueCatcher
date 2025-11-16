/**
 * Upload AESTURA results from local JSON files to Supabase
 */

import { promises as fs } from 'fs';
import path from 'path';
import { supabase } from './src/utils/supabase.js';

async function uploadAesturaResults() {
  console.log('📤 Uploading AESTURA results to Supabase...\n');

  const resultsDir = './results/2025-11-07';
  const aesturaFiles = [
    'es-aestura-com.json',
    'fr-aestura-com.json',
    'int-aestura-com-4571d7ad.json',
    'jp-aestura-com-06bff625.json'
  ];

  const runId = 'e3e07a42-5922-4839-8b38-fa36ac0ddf51';

  for (const file of aesturaFiles) {
    try {
      const filePath = path.join(resultsDir, file);
      const content = await fs.readFile(filePath, 'utf8');
      const result = JSON.parse(content);

      // Get property ID from database
      const { data: properties } = await supabase
        .from('properties')
        .select('id')
        .eq('representative_url', result.url)
        .single();

      if (!properties) {
        console.log(`❌ Property not found for ${result.url}`);
        continue;
      }

      // Prepare crawl result
      const crawlResult = {
        run_id: runId,
        property_id: properties.id,
        property_name: result.propertyName,
        url: result.url,
        is_valid: result.isValid,
        issues: result.issues || [],
        measurement_id: result.measurementId,
        gtm_container_id: result.gtmId,
        page_view_event: result.pageViewEvent,
        ap_data: result.apData,
        execution_time_ms: result.executionTimeMs,
        page_load: result.pageLoad,
        phase: result.phase,
        created_at: new Date().toISOString()
      };

      // Insert to database
      const { data, error } = await supabase
        .from('crawl_results')
        .upsert(crawlResult, {
          onConflict: 'run_id,property_id'
        })
        .select();

      if (error) {
        console.error(`❌ Failed to upload ${result.propertyName}:`, error.message);
      } else {
        console.log(`✅ Uploaded: ${result.propertyName}`);
        console.log(`   Valid: ${result.isValid}`);
        if (result.measurementId?.extractionSource?.consentMode) {
          console.log(`   Consent Mode: ${result.measurementId.extractionSource.consentMode.type}`);
        }
      }
    } catch (error) {
      console.error(`❌ Error processing ${file}:`, error.message);
    }
  }

  console.log('\n✅ Upload complete!');
}

uploadAesturaResults().catch(console.error);