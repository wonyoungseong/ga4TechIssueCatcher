/**
 * Lock Manager Module
 *
 * Prevents concurrent cron job executions using lock files
 *
 * Epic 2: Browser Automation & Parallel Crawling
 * Story 2.4: Cron Job Automation
 */

import fs from 'fs';
import path from 'path';

export const LOCK_FILE_PATH = '/tmp/ga4-catcher.lock';

/**
 * Acquire lock to prevent concurrent execution (AC5)
 *
 * @returns {Promise<boolean>} True if lock acquired, false if already locked
 * @throws {Error} If lock file operations fail
 */
export async function acquireLock() {
  try {
    // Check if lock file exists
    if (fs.existsSync(LOCK_FILE_PATH)) {
      // Read PID from lock file
      const pidStr = fs.readFileSync(LOCK_FILE_PATH, 'utf8').trim();
      const pid = parseInt(pidStr, 10);

      console.log(`⚠️ Lock file exists with PID ${pid}`);
      console.log('🛑 Previous execution still running. Skipping this execution...');

      return false;
    }

    // Create lock file with current process PID
    fs.writeFileSync(LOCK_FILE_PATH, process.pid.toString(), 'utf8');
    console.log(`🔒 Lock acquired (PID: ${process.pid})`);

    return true;
  } catch (error) {
    console.error('❌ Error acquiring lock:', error.message);
    throw new Error(`Failed to acquire lock: ${error.message}`);
  }
}

/**
 * Release lock after execution completes (AC5)
 *
 * @returns {Promise<void>}
 */
export async function releaseLock() {
  try {
    if (fs.existsSync(LOCK_FILE_PATH)) {
      fs.unlinkSync(LOCK_FILE_PATH);
      console.log(`🔓 Lock released (PID: ${process.pid})`);
    }
  } catch (error) {
    console.error('⚠️ Error releasing lock:', error.message);
    // Don't throw - lock cleanup is best-effort
  }
}

/**
 * Check if lock file exists
 *
 * @returns {boolean} True if lock exists
 */
export function isLocked() {
  return fs.existsSync(LOCK_FILE_PATH);
}

/**
 * Get PID from lock file
 *
 * @returns {number|null} PID from lock file or null if no lock
 */
export function getLockPid() {
  try {
    if (fs.existsSync(LOCK_FILE_PATH)) {
      const pidStr = fs.readFileSync(LOCK_FILE_PATH, 'utf8').trim();
      return parseInt(pidStr, 10);
    }
    return null;
  } catch (error) {
    console.error('⚠️ Error reading lock PID:', error.message);
    return null;
  }
}

/**
 * Setup process handlers to ensure lock cleanup (AC5)
 * Handles both normal exit and error scenarios
 */
export function setupLockCleanup() {
  // Normal exit
  process.on('exit', () => {
    if (fs.existsSync(LOCK_FILE_PATH)) {
      try {
        fs.unlinkSync(LOCK_FILE_PATH);
      } catch (error) {
        // Ignore errors during exit
      }
    }
  });

  // Graceful termination signals
  const signals = ['SIGINT', 'SIGTERM', 'SIGHUP'];
  signals.forEach(signal => {
    process.on(signal, () => {
      console.log(`\n🛑 Received ${signal}, cleaning up...`);
      releaseLock().finally(() => {
        process.exit(0);
      });
    });
  });

  // Uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    releaseLock().finally(() => {
      process.exit(1);
    });
  });

  // Unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    releaseLock().finally(() => {
      process.exit(1);
    });
  });
}

export default {
  acquireLock,
  releaseLock,
  isLocked,
  getLockPid,
  setupLockCleanup,
  LOCK_FILE_PATH
};
