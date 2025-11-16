#!/usr/bin/env node

/**
 * GA4 Tech Issue Catcher - Main Entry Point
 *
 * Automated GA4/GTM configuration validation system for 100+ Amorepacific properties.
 *
 * Usage:
 *   npm start
 *   node src/index.js
 */

import 'dotenv/config';
import { runValidation } from './modules/orchestrator.js';
import { supabase, Tables, CrawlRunStatus } from './utils/supabase.js';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

// Configure dayjs with timezone support
dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Main function
 */
async function main() {
  try {
    // Load configuration from environment variables
    const browserPoolSize = parseInt(process.env.BROWSER_POOL_SIZE) || 7;
    const csvPath = process.env.CSV_PATH || './src/ga4Property/Amore_GA4_PropertList.csv';

    // Validate configuration
    if (!csvPath) {
      throw new Error('CSV_PATH environment variable is required');
    }

    // Create crawl run record in database (required for batch upload)
    const now = dayjs().tz('Asia/Seoul');
    const runDate = now.format('YYYY-MM-DD');
    const startedAt = now.toISOString();

    console.log('\n📋 Creating crawl run in database...');
    const { data: crawlRun, error: createError } = await supabase
      .from(Tables.CRAWL_RUNS)
      .insert({
        run_date: runDate,
        status: CrawlRunStatus.RUNNING,
        browser_pool_size: browserPoolSize,
        started_at: startedAt
      })
      .select()
      .single();

    if (createError) {
      throw new Error(`Failed to create crawl run: ${createError.message}`);
    }

    console.log(`✅ Crawl run created: ${crawlRun.id}\n`);

    // Prepare config with runId
    const config = {
      csvPath,
      browserPoolSize,
      slackWebhookUrl: process.env.SLACK_WEBHOOK_URL || null,
      retentionDays: parseInt(process.env.RETENTION_DAYS) || 30,
      runId: crawlRun.id // Include runId for batch upload
    };

    // Run validation
    const summary = await runValidation(config);

    // Update crawl run with completion status
    const completedAt = dayjs().tz('Asia/Seoul').toISOString();
    const durationSeconds = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
    const finalStatus = summary.wasCancelled ? CrawlRunStatus.CANCELLED : CrawlRunStatus.COMPLETED;

    console.log('\n📊 Updating crawl run status...');
    await supabase
      .from(Tables.CRAWL_RUNS)
      .update({
        status: finalStatus,
        completed_at: completedAt,
        duration_seconds: durationSeconds,
        completed_properties: summary.successfulValidations || 0,
        failed_properties: summary.errorCount || 0,
        properties_with_issues: summary.failedValidations || 0
      })
      .eq('id', crawlRun.id);

    console.log(`✅ Crawl run updated: ${finalStatus}\n`);

    // Exit with appropriate code
    if (summary.failedValidations > 0 || summary.errorCount > 0) {
      console.log('⚠️ Validation completed with issues');
      process.exit(1);
    } else {
      console.log('✅ All validations passed');
      process.exit(0);
    }

  } catch (error) {
    console.error('\n💥 Fatal Error:', error.message);
    console.error(error.stack);

    // Try to update crawl run status to failed if we have the crawlRun object
    try {
      if (typeof crawlRun !== 'undefined' && crawlRun?.id) {
        const failedAt = dayjs().tz('Asia/Seoul').toISOString();
        await supabase
          .from(Tables.CRAWL_RUNS)
          .update({
            status: CrawlRunStatus.FAILED,
            completed_at: failedAt,
            error_message: error.message
          })
          .eq('id', crawlRun.id);
      }
    } catch (updateError) {
      // Silently fail - we're already in error handling
    }

    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Run main function
main();
