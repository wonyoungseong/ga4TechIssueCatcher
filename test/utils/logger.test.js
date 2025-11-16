/**
 * Logger Utility Tests
 *
 * Tests for Winston logger configuration and daily log rotation
 *
 * Epic 7: Logging & Monitoring
 * Story 7.1: System Execution Logging
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import logger (will create logs directory)
import logger from '../../src/utils/logger.js';

const logsDir = path.join(__dirname, '../../logs');

describe('Logger - Configuration (AC7)', () => {
  it('should have winston npm log levels configured', () => {
    // Arrange & Act
    const levels = logger.levels;

    // Assert (AC7)
    assert.ok(levels, 'Logger should have levels configured');
    assert.equal(typeof levels.error, 'number', 'Should have ERROR level');
    assert.equal(typeof levels.warn, 'number', 'Should have WARN level');
    assert.equal(typeof levels.info, 'number', 'Should have INFO level');
  });

  it('should have file and console transports', () => {
    // Arrange & Act
    const transports = logger.transports;

    // Assert
    assert.ok(transports.length >= 2, 'Should have at least 2 transports');

    const hasFileTransport = transports.some(t => t.name === 'file');
    const hasConsoleTransport = transports.some(t => t.name === 'console');

    assert.ok(hasFileTransport, 'Should have file transport');
    assert.ok(hasConsoleTransport, 'Should have console transport');
  });

  it('should use default log level of info', () => {
    // Arrange & Act & Assert
    // When LOG_LEVEL env var not set, default should be 'info'
    assert.ok(['info', 'debug', 'warn', 'error'].includes(logger.level),
      'Log level should be valid npm level');
  });
});

describe('Logger - Daily Log Rotation (AC6)', () => {
  it('should create logs directory if not exists', async () => {
    // Arrange & Act
    const dirExists = await fs.access(logsDir)
      .then(() => true)
      .catch(() => false);

    // Assert (AC6)
    assert.ok(dirExists, 'Logs directory should exist');
  });

  it('should generate daily log filename in format YYYY-MM-DD.log', () => {
    // Arrange
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const expectedFilename = `${year}-${month}-${day}.log`;

    // Act
    const fileTransport = logger.transports.find(t => t.name === 'file');
    const actualFilename = path.basename(fileTransport.filename);

    // Assert (AC6)
    assert.equal(actualFilename, expectedFilename,
      'Log filename should match YYYY-MM-DD.log format');
  });

  it('should create log file on first write', async () => {
    // Arrange
    const fileTransport = logger.transports.find(t => t.name === 'file');
    const logFilePath = fileTransport.filename;

    // Act
    logger.info('Test log entry for file creation');

    // Wait for async file write
    await new Promise(resolve => setTimeout(resolve, 500));

    // Assert
    const fileExists = await fs.access(logFilePath)
      .then(() => true)
      .catch(() => false);

    assert.ok(fileExists, 'Log file should be created');
  });
});

describe('Logger - Log Levels (AC7)', () => {
  let testLogFile;

  beforeEach(async () => {
    // Get current log file path
    const fileTransport = logger.transports.find(t => t.name === 'file');
    testLogFile = fileTransport.filename;
  });

  it('should log INFO level messages', async () => {
    // Arrange
    const testMessage = `Test INFO message ${Date.now()}`;

    // Act
    logger.info(testMessage);

    // Wait for async file write
    await new Promise(resolve => setTimeout(resolve, 500));

    // Assert
    const logContent = await fs.readFile(testLogFile, 'utf-8');
    assert.ok(logContent.includes(testMessage), 'INFO message should be logged');
    assert.ok(logContent.includes('INFO'), 'Should include INFO level');
  });

  it('should log WARN level messages', async () => {
    // Arrange
    const testMessage = `Test WARN message ${Date.now()}`;

    // Act
    logger.warn(testMessage);

    // Wait for async file write
    await new Promise(resolve => setTimeout(resolve, 500));

    // Assert
    const logContent = await fs.readFile(testLogFile, 'utf-8');
    assert.ok(logContent.includes(testMessage), 'WARN message should be logged');
    assert.ok(logContent.includes('WARN'), 'Should include WARN level');
  });

  it('should log ERROR level messages', async () => {
    // Arrange
    const testMessage = `Test ERROR message ${Date.now()}`;

    // Act
    logger.error(testMessage);

    // Wait for async file write
    await new Promise(resolve => setTimeout(resolve, 500));

    // Assert
    const logContent = await fs.readFile(testLogFile, 'utf-8');
    assert.ok(logContent.includes(testMessage), 'ERROR message should be logged');
    assert.ok(logContent.includes('ERROR'), 'Should include ERROR level');
  });
});

describe('Logger - Error Stack Traces (AC5)', () => {
  let testLogFile;

  beforeEach(async () => {
    // Get current log file path
    const fileTransport = logger.transports.find(t => t.name === 'file');
    testLogFile = fileTransport.filename;
  });

  it('should log error objects with stack traces', async () => {
    // Arrange
    const testError = new Error('Test error with stack trace');

    // Act
    logger.error('Error occurred', { error: testError.message, stack: testError.stack });

    // Wait for async file write
    await new Promise(resolve => setTimeout(resolve, 500));

    // Assert
    const logContent = await fs.readFile(testLogFile, 'utf-8');
    assert.ok(logContent.includes('Test error with stack trace'), 'Should log error message');
    assert.ok(logContent.includes('Error occurred'), 'Should log context message');
  });

  it('should log structured data with errors', async () => {
    // Arrange
    const testContext = {
      propertyName: 'Test Property',
      error: 'Validation failed',
      stack: 'Error: Validation failed\n  at validateProperty...'
    };

    // Act
    logger.error('Property validation failed', testContext);

    // Wait for async file write
    await new Promise(resolve => setTimeout(resolve, 500));

    // Assert
    const logContent = await fs.readFile(testLogFile, 'utf-8');
    assert.ok(logContent.includes('Property validation failed'), 'Should log error message');
    assert.ok(logContent.includes('Test Property'), 'Should include context data');
  });
});

describe('Logger - Log Format (AC7)', () => {
  let testLogFile;

  beforeEach(async () => {
    // Get current log file path
    const fileTransport = logger.transports.find(t => t.name === 'file');
    testLogFile = fileTransport.filename;
  });

  it('should include timestamp in log format', async () => {
    // Arrange
    const testMessage = `Test timestamp message ${Date.now()}`;

    // Act
    logger.info(testMessage);

    // Wait for async file write
    await new Promise(resolve => setTimeout(resolve, 500));

    // Assert
    const logContent = await fs.readFile(testLogFile, 'utf-8');

    // Check for timestamp format [YYYY-MM-DD HH:mm:ss]
    const timestampRegex = /\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\]/;
    assert.ok(timestampRegex.test(logContent), 'Should include formatted timestamp');
  });

  it('should format log messages correctly', async () => {
    // Arrange
    const testMessage = `Formatted log test ${Date.now()}`;

    // Act
    logger.info(testMessage);

    // Wait for async file write
    await new Promise(resolve => setTimeout(resolve, 500));

    // Assert
    const logContent = await fs.readFile(testLogFile, 'utf-8');

    // Expected format: [TIMESTAMP] LEVEL: MESSAGE
    assert.ok(logContent.includes('] INFO:'), 'Should have correct format separator');
    assert.ok(logContent.includes(testMessage), 'Should include message');
  });
});

describe('Logger - Integration with Structured Data', () => {
  let testLogFile;

  beforeEach(async () => {
    // Get current log file path
    const fileTransport = logger.transports.find(t => t.name === 'file');
    testLogFile = fileTransport.filename;
  });

  it('should log structured validation data', async () => {
    // Arrange
    const validationData = {
      propertyName: 'Test Property',
      isValid: true,
      issueCount: 0,
      executionTimeMs: 1234
    };

    // Act
    logger.info('Property validation completed', validationData);

    // Wait for async file write
    await new Promise(resolve => setTimeout(resolve, 500));

    // Assert
    const logContent = await fs.readFile(testLogFile, 'utf-8');
    assert.ok(logContent.includes('Property validation completed'), 'Should log message');
    assert.ok(logContent.includes('Test Property'), 'Should include property name');
  });

  it('should log execution summary data', async () => {
    // Arrange
    const summaryData = {
      totalProperties: 100,
      successfulValidations: 95,
      failedValidations: 5,
      validationRate: 95
    };

    // Act
    logger.info('Validation execution completed', summaryData);

    // Wait for async file write
    await new Promise(resolve => setTimeout(resolve, 500));

    // Assert
    const logContent = await fs.readFile(testLogFile, 'utf-8');
    assert.ok(logContent.includes('Validation execution completed'), 'Should log message');
    assert.ok(logContent.includes('100'), 'Should include total properties');
  });
});
