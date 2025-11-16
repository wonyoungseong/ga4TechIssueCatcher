/**
 * Winston Logger Configuration
 *
 * Provides structured logging with daily file rotation and level-based filtering
 *
 * Epic 7: Logging & Monitoring
 * Story 7.1: System Execution Logging
 */

import winston from 'winston';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure logs directory exists (AC6)
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Generate daily log filename in format: logs/YYYY-MM-DD.log (AC6)
 */
function getDailyLogFilename() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return path.join(logsDir, `${year}-${month}-${day}.log`);
}

// Log format configuration (AC7)
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }), // Include stack traces (AC5)
  winston.format.printf(({ timestamp, level, message, stack }) => {
    // Format: [TIMESTAMP] LEVEL: MESSAGE (with optional stack trace for errors)
    const baseLog = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    return stack ? `${baseLog}\n${stack}` : baseLog;
  })
);

// Logger configuration
const logger = winston.createLogger({
  // Log levels: ERROR (0), WARN (1), INFO (2), DEBUG (3) (AC7)
  levels: winston.config.npm.levels,
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: [
    // File transport with daily rotation (AC6)
    new winston.transports.File({
      filename: getDailyLogFilename(),
      level: 'info'
    }),
    // Console transport for development
    new winston.transports.Console({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      )
    })
  ]
});

// Update log file path daily (AC6)
setInterval(() => {
  const newFilename = getDailyLogFilename();
  const fileTransport = logger.transports.find(t => t.name === 'file');
  if (fileTransport && fileTransport.filename !== newFilename) {
    fileTransport.filename = newFilename;
  }
}, 60000); // Check every minute

export default logger;
