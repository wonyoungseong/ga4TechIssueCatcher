/**
 * Supabase Client Configuration
 *
 * Provides configured Supabase client instances for database operations.
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

// Validate required environment variables
const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  throw new Error(
    `Missing required Supabase environment variables: ${missingVars.join(', ')}\n` +
    'Please check your .env file and ensure all Supabase credentials are set.\n' +
    'See SUPABASE_SETUP.md for setup instructions.'
  );
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Server-side Supabase client with service role key
 *
 * This client bypasses RLS and should ONLY be used server-side.
 * Use for administrative operations, data imports, and backend logic.
 */
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

/**
 * Test Supabase connection
 *
 * @returns {Promise<boolean>} True if connection successful
 */
export async function testConnection() {
  try {
    const { data, error } = await supabase
      .from('properties')
      .select('count')
      .limit(1);

    if (error) {
      console.error('Supabase connection test failed:', error.message);
      return false;
    }

    console.log('✅ Supabase connection successful');
    return true;
  } catch (error) {
    console.error('Supabase connection test error:', error.message);
    return false;
  }
}

/**
 * Database table names (for reference and type safety)
 */
export const Tables = {
  PROPERTIES: 'properties',
  CRAWL_RUNS: 'crawl_runs',
  CRAWL_RESULTS: 'crawl_results',
  PROPERTY_STATUS_HISTORY: 'property_status_history',
  RETRY_QUEUE: 'retry_queue'
};

/**
 * Property status enum
 */
export const PropertyStatus = {
  NORMAL: 'normal',
  ISSUE: 'issue',
  DEBUGGING: 'debugging'
};

/**
 * Crawl run status enum
 */
export const CrawlRunStatus = {
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

/**
 * Validation status enum
 */
export const ValidationStatus = {
  PASSED: 'passed',
  FAILED: 'failed',
  ERROR: 'error'
};

export default supabase;
