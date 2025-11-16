/**
 * Lock Manager Module Tests
 *
 * Tests for cron job lock file mechanism
 *
 * Epic 2: Browser Automation & Parallel Crawling
 * Story 2.4: Cron Job Automation
 */

import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { acquireLock, releaseLock, isLocked, getLockPid, LOCK_FILE_PATH } from '../../src/modules/lockManager.js';

describe('Lock Manager - Lock Acquisition (AC5)', () => {
  // Cleanup before and after tests
  beforeEach(() => {
    // Remove lock file if it exists
    if (fs.existsSync(LOCK_FILE_PATH)) {
      fs.unlinkSync(LOCK_FILE_PATH);
    }
  });

  afterEach(() => {
    // Cleanup lock file
    if (fs.existsSync(LOCK_FILE_PATH)) {
      fs.unlinkSync(LOCK_FILE_PATH);
    }
  });

  it('should acquire lock when no lock exists', async () => {
    // Arrange
    assert.ok(!fs.existsSync(LOCK_FILE_PATH), 'Lock file should not exist initially');

    // Act
    const acquired = await acquireLock();

    // Assert (AC5)
    assert.equal(acquired, true, 'Should successfully acquire lock');
    assert.ok(fs.existsSync(LOCK_FILE_PATH), 'Lock file should be created');

    // Verify PID is written
    const pidStr = fs.readFileSync(LOCK_FILE_PATH, 'utf8');
    const pid = parseInt(pidStr, 10);
    assert.equal(pid, process.pid, 'Lock file should contain current process PID');
  });

  it('should fail to acquire lock when lock already exists', async () => {
    // Arrange - Create existing lock with different PID
    fs.writeFileSync(LOCK_FILE_PATH, '99999', 'utf8');

    // Act
    const acquired = await acquireLock();

    // Assert (AC5)
    assert.equal(acquired, false, 'Should fail to acquire lock');

    // Verify original lock file is unchanged
    const pidStr = fs.readFileSync(LOCK_FILE_PATH, 'utf8');
    assert.equal(pidStr, '99999', 'Original lock file should remain unchanged');
  });

  it('should write current process PID to lock file', async () => {
    // Act
    await acquireLock();

    // Assert
    const pidStr = fs.readFileSync(LOCK_FILE_PATH, 'utf8').trim();
    const pid = parseInt(pidStr, 10);

    assert.ok(!isNaN(pid), 'PID should be a valid number');
    assert.equal(pid, process.pid, 'Should write current process PID');
  });
});

describe('Lock Manager - Lock Release (AC5)', () => {
  beforeEach(() => {
    if (fs.existsSync(LOCK_FILE_PATH)) {
      fs.unlinkSync(LOCK_FILE_PATH);
    }
  });

  afterEach(() => {
    if (fs.existsSync(LOCK_FILE_PATH)) {
      fs.unlinkSync(LOCK_FILE_PATH);
    }
  });

  it('should release lock and remove lock file', async () => {
    // Arrange
    await acquireLock();
    assert.ok(fs.existsSync(LOCK_FILE_PATH), 'Lock file should exist');

    // Act
    await releaseLock();

    // Assert (AC5)
    assert.ok(!fs.existsSync(LOCK_FILE_PATH), 'Lock file should be removed');
  });

  it('should handle release when no lock exists (idempotent)', async () => {
    // Arrange
    assert.ok(!fs.existsSync(LOCK_FILE_PATH), 'Lock file should not exist');

    // Act & Assert - Should not throw
    await releaseLock();

    assert.ok(!fs.existsSync(LOCK_FILE_PATH), 'Lock file should still not exist');
  });

  it('should cleanup lock file even after multiple releases', async () => {
    // Arrange
    await acquireLock();

    // Act
    await releaseLock();
    await releaseLock(); // Second release

    // Assert
    assert.ok(!fs.existsSync(LOCK_FILE_PATH), 'Lock file should not exist');
  });
});

describe('Lock Manager - Lock Status Check', () => {
  beforeEach(() => {
    if (fs.existsSync(LOCK_FILE_PATH)) {
      fs.unlinkSync(LOCK_FILE_PATH);
    }
  });

  afterEach(() => {
    if (fs.existsSync(LOCK_FILE_PATH)) {
      fs.unlinkSync(LOCK_FILE_PATH);
    }
  });

  it('should return false when no lock exists', () => {
    // Assert
    assert.equal(isLocked(), false, 'Should return false when no lock exists');
  });

  it('should return true when lock exists', async () => {
    // Arrange
    await acquireLock();

    // Assert
    assert.equal(isLocked(), true, 'Should return true when lock exists');
  });

  it('should return null PID when no lock exists', () => {
    // Assert
    assert.equal(getLockPid(), null, 'Should return null when no lock');
  });

  it('should return correct PID from lock file', async () => {
    // Arrange
    await acquireLock();

    // Act
    const pid = getLockPid();

    // Assert
    assert.equal(pid, process.pid, 'Should return current process PID');
  });
});

describe('Lock Manager - Concurrent Execution Prevention (AC5)', () => {
  beforeEach(() => {
    if (fs.existsSync(LOCK_FILE_PATH)) {
      fs.unlinkSync(LOCK_FILE_PATH);
    }
  });

  afterEach(() => {
    if (fs.existsSync(LOCK_FILE_PATH)) {
      fs.unlinkSync(LOCK_FILE_PATH);
    }
  });

  it('should prevent concurrent execution when lock exists', async () => {
    // Arrange - First execution acquires lock
    const firstAcquire = await acquireLock();
    assert.ok(firstAcquire, 'First execution should acquire lock');

    // Act - Second execution attempts to acquire lock
    const secondAcquire = await acquireLock();

    // Assert (AC5)
    assert.equal(secondAcquire, false, 'Second execution should be prevented');
    assert.ok(fs.existsSync(LOCK_FILE_PATH), 'Lock file should still exist');

    // Verify lock still has original PID
    const pid = getLockPid();
    assert.equal(pid, process.pid, 'Lock should preserve original PID');
  });

  it('should allow new execution after lock is released', async () => {
    // Arrange - First execution
    await acquireLock();
    await releaseLock();

    // Act - Second execution after release
    const acquired = await acquireLock();

    // Assert
    assert.ok(acquired, 'New execution should acquire lock after release');
    assert.ok(fs.existsSync(LOCK_FILE_PATH), 'New lock file should be created');

    // Cleanup
    await releaseLock();
  });
});

describe('Lock Manager - Error Handling', () => {
  afterEach(() => {
    if (fs.existsSync(LOCK_FILE_PATH)) {
      fs.unlinkSync(LOCK_FILE_PATH);
    }
  });

  it('should handle corrupted lock file gracefully', async () => {
    // Arrange - Create lock file with invalid content
    fs.writeFileSync(LOCK_FILE_PATH, 'invalid-pid', 'utf8');

    // Act
    const pid = getLockPid();

    // Assert - Should return NaN when parsing fails
    assert.ok(isNaN(pid), 'Should return NaN for invalid PID');

    // Cleanup
    fs.unlinkSync(LOCK_FILE_PATH);
  });

  it('should handle lock file with empty content', async () => {
    // Arrange
    fs.writeFileSync(LOCK_FILE_PATH, '', 'utf8');

    // Act
    const pid = getLockPid();

    // Assert
    assert.ok(isNaN(pid) || pid === 0, 'Should handle empty lock file');

    // Cleanup
    fs.unlinkSync(LOCK_FILE_PATH);
  });
});

describe('Lock Manager - Lock File Path', () => {
  it('should use /tmp directory for lock file', () => {
    // Assert
    assert.ok(LOCK_FILE_PATH.startsWith('/tmp'), 'Lock file should be in /tmp directory');
    assert.ok(LOCK_FILE_PATH.includes('ga4-catcher'), 'Lock file name should include ga4-catcher');
  });

  it('should use .lock extension', () => {
    // Assert
    assert.ok(LOCK_FILE_PATH.endsWith('.lock'), 'Lock file should have .lock extension');
  });
});
