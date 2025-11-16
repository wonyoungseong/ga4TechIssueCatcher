/**
 * Cron Logger Module
 *
 * Provides logging functionality specific to cron job execution
 *
 * Epic 2: Browser Automation & Parallel Crawling
 * Story 2.4: Cron Job Automation
 */

import fs from 'fs';
import path from 'path';

const LOG_DIR = path.join(process.cwd(), 'logs');
const CRON_LOG_FILE = path.join(LOG_DIR, 'cron.log');

/**
 * Ensure log directory exists
 */
function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

/**
 * Get formatted timestamp
 *
 * @returns {string} Formatted timestamp
 */
function getTimestamp() {
  return new Date().toISOString();
}

/**
 * Write log entry to cron.log file
 *
 * @param {string} level - Log level (INFO, ERROR, WARN)
 * @param {string} message - Log message
 * @param {Object} [data] - Additional data to log
 */
function writeLog(level, message, data = null) {
  ensureLogDir();

  const timestamp = getTimestamp();
  const logEntry = {
    timestamp,
    level,
    message,
    ...(data && { data })
  };

  const logLine = JSON.stringify(logEntry) + '\n';

  try {
    fs.appendFileSync(CRON_LOG_FILE, logLine, 'utf8');
  } catch (error) {
    console.error('Failed to write to cron log:', error.message);
  }
}

/**
 * Log cron job start (AC4)
 *
 * @param {Object} options - Execution options
 */
export function logCronStart(options = {}) {
  const message = '🚀 Cron job execution started';

  console.log('\n' + '='.repeat(70));
  console.log(message);
  console.log(`📅 Start Time: ${getTimestamp()}`);
  console.log(`🔧 Process PID: ${process.pid}`);
  console.log(`📂 Working Directory: ${process.cwd()}`);
  console.log(`🔧 Node Version: ${process.version}`);

  if (options.propertyCount) {
    console.log(`📊 Properties to Validate: ${options.propertyCount}`);
  }
  if (options.browserPoolSize) {
    console.log(`🌐 Browser Pool Size: ${options.browserPoolSize}`);
  }

  console.log('='.repeat(70) + '\n');

  writeLog('INFO', message, {
    pid: process.pid,
    cwd: process.cwd(),
    nodeVersion: process.version,
    ...options
  });
}

/**
 * Log cron job completion (AC4)
 *
 * @param {Object} results - Execution results
 */
export function logCronComplete(results = {}) {
  const message = '✅ Cron job execution completed successfully';

  console.log('\n' + '='.repeat(70));
  console.log(message);
  console.log(`📅 End Time: ${getTimestamp()}`);

  if (results.executionTimeMs) {
    const minutes = (results.executionTimeMs / 1000 / 60).toFixed(2);
    console.log(`⏱️  Execution Time: ${minutes} minutes`);
  }
  if (results.successCount !== undefined) {
    console.log(`✅ Successful: ${results.successCount}`);
  }
  if (results.errorCount !== undefined) {
    console.log(`❌ Failed: ${results.errorCount}`);
  }
  if (results.totalCount !== undefined) {
    console.log(`📊 Total Processed: ${results.totalCount}`);
  }

  console.log('='.repeat(70) + '\n');

  writeLog('INFO', message, results);
}

/**
 * Log cron job error (AC3)
 *
 * @param {Error} error - Error object
 * @param {Object} context - Additional context
 */
export function logCronError(error, context = {}) {
  const message = '❌ Cron job execution failed';

  console.error('\n' + '='.repeat(70));
  console.error(message);
  console.error(`📅 Error Time: ${getTimestamp()}`);
  console.error(`🔴 Error: ${error.message}`);

  if (error.stack) {
    console.error(`📋 Stack Trace:\n${error.stack}`);
  }

  if (Object.keys(context).length > 0) {
    console.error(`📋 Context:`, JSON.stringify(context, null, 2));
  }

  console.error('='.repeat(70) + '\n');

  writeLog('ERROR', message, {
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name
    },
    ...context
  });
}

/**
 * Log cron job warning
 *
 * @param {string} message - Warning message
 * @param {Object} data - Additional data
 */
export function logCronWarning(message, data = {}) {
  console.warn(`⚠️  ${message}`);

  writeLog('WARN', message, data);
}

/**
 * Log cron job info
 *
 * @param {string} message - Info message
 * @param {Object} data - Additional data
 */
export function logCronInfo(message, data = {}) {
  console.log(`ℹ️  ${message}`);

  writeLog('INFO', message, data);
}

/**
 * Log cron job skipped due to lock (AC5)
 *
 * @param {number} existingPid - PID of existing process
 */
export function logCronSkipped(existingPid) {
  const message = '🛑 Cron job skipped - previous execution still running';

  console.log('\n' + '='.repeat(70));
  console.log(message);
  console.log(`📅 Skip Time: ${getTimestamp()}`);
  console.log(`🔒 Existing Process PID: ${existingPid}`);
  console.log('='.repeat(70) + '\n');

  writeLog('WARN', message, {
    existingPid,
    currentPid: process.pid
  });
}

export default {
  logCronStart,
  logCronComplete,
  logCronError,
  logCronWarning,
  logCronInfo,
  logCronSkipped
};
