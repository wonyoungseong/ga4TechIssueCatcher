/**
 * Retry Queue Module
 *
 * Processes failed property validations from retry queue
 * Implements exponential backoff strategy for network error recovery
 *
 * Story 10.3: Network Error Retry Queue System
 */

import supabase from '../utils/supabase.js';
import { validateSingleProperty } from './orchestrator.js';
import logger from '../utils/logger.js';

/**
 * Process pending retry queue items
 * @param {Object} browser - Playwright browser instance
 * @param {string} dateStr - Date string for validation results (YYYYMMDD)
 * @returns {Promise<Object>} Processing statistics
 */
export async function processRetryQueue(browser, dateStr) {
  console.log('\n🔄 Processing retry queue...');
  logger.info('Starting retry queue processing');

  try {
    // Fetch pending retry items that are due for retry
    const { data: pendingRetries, error: fetchError } = await supabase
      .from('retry_queue')
      .select('*, properties(*)')
      .eq('status', 'pending')
      .lte('next_retry_at', new Date().toISOString())
      .limit(50);

    if (fetchError) {
      console.error('❌ Failed to fetch retry queue:', fetchError.message);
      logger.error('Retry queue fetch failed', { error: fetchError.message });
      throw fetchError;
    }

    if (!pendingRetries || pendingRetries.length === 0) {
      console.log('✅ No pending retries');
      logger.info('Retry queue processing completed - no pending items');
      return {
        processed: 0,
        succeeded: 0,
        failed: 0,
        permanentFailures: 0
      };
    }

    console.log(`📋 Found ${pendingRetries.length} pending retry items`);

    let succeeded = 0;
    let failed = 0;
    let permanentFailures = 0;

    // Process each retry item
    for (const retry of pendingRetries) {
      if (!retry.properties) {
        console.error(`⚠️ Retry ${retry.id}: Property not found`);
        logger.error('Retry queue processing skipped - property not found', {
          retryId: retry.id,
          propertyId: retry.property_id
        });
        continue;
      }

      const property = retry.properties;
      console.log(`\n🔄 Retry ${retry.failure_count + 1}/3: ${property.property_name}`);

      try {
        // Update status to 'retrying'
        await supabase
          .from('retry_queue')
          .update({
            status: 'retrying',
            last_attempt_at: new Date().toISOString()
          })
          .eq('id', retry.id);

        // Attempt validation with Phase 2 timeout (80 seconds)
        const result = await validateSingleProperty(
          browser,
          property,
          dateStr,
          2,                    // Phase 2
          new Set(),            // timedOutPropertyIds
          80000                 // 80 second timeout
        );

        if (result.validation_status === 'passed') {
          // Success - mark as resolved
          await supabase
            .from('retry_queue')
            .update({
              status: 'resolved',
              updated_at: new Date().toISOString()
            })
            .eq('id', retry.id);

          console.log(`  ✅ ${property.property_name} - Retry successful!`);
          logger.info('Retry successful', {
            propertyName: property.property_name,
            propertyId: property.id,
            retryCount: retry.failure_count + 1
          });
          succeeded++;
        } else {
          // Failure - check if max retries reached
          const newFailureCount = retry.failure_count + 1;

          if (newFailureCount >= 3) {
            // Permanent failure after 3 attempts
            await supabase
              .from('retry_queue')
              .update({
                status: 'permanent_failure',
                failure_count: newFailureCount,
                updated_at: new Date().toISOString()
              })
              .eq('id', retry.id);

            console.log(`  ❌ ${property.property_name} - Permanent failure (3 attempts)`);
            logger.warn('Retry permanent failure', {
              propertyName: property.property_name,
              propertyId: property.id,
              totalAttempts: newFailureCount
            });
            permanentFailures++;
          } else {
            // Schedule next retry with exponential backoff
            const backoffMinutes = Math.pow(2, newFailureCount) * 30; // 30min → 1hr → 2hr
            const nextRetry = new Date(Date.now() + backoffMinutes * 60 * 1000);

            await supabase
              .from('retry_queue')
              .update({
                status: 'pending',
                failure_count: newFailureCount,
                last_attempt_at: new Date().toISOString(),
                next_retry_at: nextRetry.toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('id', retry.id);

            console.log(`  ⏳ ${property.property_name} - Retry ${newFailureCount}/3 failed, next retry in ${backoffMinutes} minutes`);
            logger.info('Retry failed, scheduled next attempt', {
              propertyName: property.property_name,
              propertyId: property.id,
              failureCount: newFailureCount,
              nextRetryAt: nextRetry.toISOString(),
              backoffMinutes
            });
            failed++;
          }
        }
      } catch (error) {
        console.error(`  ❌ Error processing retry for ${property.property_name}:`, error.message);
        logger.error('Retry processing error', {
          propertyName: property.property_name,
          propertyId: property.id,
          error: error.message,
          stack: error.stack
        });

        // Mark as pending for next retry
        await supabase
          .from('retry_queue')
          .update({
            status: 'pending',
            updated_at: new Date().toISOString()
          })
          .eq('id', retry.id);

        failed++;
      }
    }

    const stats = {
      processed: pendingRetries.length,
      succeeded,
      failed,
      permanentFailures
    };

    console.log('\n✅ Retry queue processing completed');
    console.log(`   Processed: ${stats.processed}`);
    console.log(`   Succeeded: ${stats.succeeded}`);
    console.log(`   Failed: ${stats.failed}`);
    console.log(`   Permanent Failures: ${stats.permanentFailures}`);

    logger.info('Retry queue processing completed', stats);

    return stats;
  } catch (error) {
    console.error('❌ Retry queue processing failed:', error.message);
    logger.error('Retry queue processing failed', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}
