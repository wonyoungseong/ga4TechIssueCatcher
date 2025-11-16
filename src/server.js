#!/usr/bin/env node

/**
 * GA4 Tech Issue Catcher - Web Dashboard Server
 *
 * Express.js server with REST API and WebSocket for real-time updates.
 * Serves the web dashboard and provides validation results.
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { WebSocketServer, WebSocket } from 'ws';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import { testConnection } from './utils/supabase.js';
import propertiesRouter from './routes/properties.js';
import crawlRouter, { getCrawlState, setBroadcastForCrawl } from './routes/crawl.js';
import cleanupRouter from './routes/cleanup.js';
import crawlerSettingsRouter from './routes/crawlerSettings.js';
import retryRouter from './routes/retry.js';
import { setBroadcast } from './modules/orchestrator.js';
import { getCleanupScheduler } from './utils/cleanupScheduler.js';
import { getRetryScheduler } from './utils/retryScheduler.js';
import { recoverIncompleteCrawls } from './utils/startupRecovery.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.SERVER_PORT || 3000;

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ server, path: '/ws' });

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('📱 Client connected to WebSocket');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('📩 Received:', data);

      // Handle client messages
      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      } else if (data.type === 'subscribe_crawl_status') {
        // Send current crawl status immediately
        const crawlState = getCrawlState();
        ws.send(JSON.stringify({
          type: 'crawl_status',
          data: crawlState
        }));
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  });

  ws.on('close', () => {
    console.log('📱 Client disconnected');
  });

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connected',
    message: 'Connected to GA4 Tech Issue Catcher'
  }));

  // Send initial crawl status
  const crawlState = getCrawlState();
  if (crawlState.isRunning) {
    ws.send(JSON.stringify({
      type: 'crawl_status',
      data: crawlState
    }));
  }
});

// Broadcast to all connected clients
export function broadcast(data) {
  const message = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Connect broadcast function to orchestrator and crawl routes (avoid circular dependency)
setBroadcast(broadcast);
setBroadcastForCrawl(broadcast);

// Rate limiting middleware (SEC-001: DoS protection)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: { success: false, error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for localhost in development
  skip: (req) => {
    const isLocalhost = req.ip === '127.0.0.1' ||
                       req.ip === '::1' ||
                       req.ip === '::ffff:127.0.0.1' ||
                       req.hostname === 'localhost';
    return isLocalhost && process.env.NODE_ENV !== 'production';
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use('/api/', apiLimiter); // Apply rate limiting to all API routes (skips localhost in development)

// API Routes
app.use('/api/properties', propertiesRouter);
app.use('/api/crawl', crawlRouter);
app.use('/api/cleanup', cleanupRouter);
app.use('/api/crawler-settings', crawlerSettingsRouter);
app.use('/api/retry-queue', retryRouter);

// Helper functions
async function getAvailableDates(baseDir) {
  try {
    const entries = await fs.readdir(baseDir);
    const dates = [];

    for (const entry of entries) {
      const stat = await fs.stat(path.join(baseDir, entry));
      if (stat.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(entry)) {
        dates.push(entry);
      }
    }

    return dates.sort().reverse(); // Most recent first
  } catch (error) {
    return [];
  }
}

async function getResultsForDate(date) {
  try {
    // Import supabase dynamically
    const { supabase, Tables } = await import('./utils/supabase.js');

    // Fetch from Supabase with screenshot URLs
    const { data, error } = await supabase
      .from(Tables.CRAWL_RESULTS)
      .select(`
        *,
        properties (
          property_name
        )
      `)
      .gte('created_at', `${date}T00:00:00Z`)
      .lt('created_at', `${date}T23:59:59Z`)
      .order('created_at', { ascending: false});

    if (error) {
      console.error(`Error fetching results for ${date}:`, error.message);
      return [];
    }

    // Transform to match expected format
    return data.map(row => ({
      propertyName: row.properties?.property_name || row.property_id,
      slug: row.property_id,
      validationTime: row.created_at,
      url: row.validation_result?.url,
      measurementId: row.validation_result?.measurementId,
      gtmId: row.validation_result?.gtmId,
      pageViewEvent: row.validation_result?.pageViewEvent,
      apData: row.validation_result?.apData,
      issues: row.validation_result?.issues || [],
      isValid: row.validation_result?.isValid,
      executionTimeMs: row.validation_result?.executionTimeMs,
      pageLoad: row.validation_result?.pageLoad,
      phase: row.validation_result?.phase,
      screenshot_url: row.screenshot_url,
      permanent_screenshot_url: row.permanent_screenshot_url
    }));
  } catch (error) {
    console.error('Error in getResultsForDate:', error.message);
    return [];
  }
}

async function getSummaryForDate(date) {
  try {
    const summaryPath = path.join('results', date, '_summary.json');
    const content = await fs.readFile(summaryPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

// API Routes

// Get server status
app.get('/api/status', async (req, res) => {
  try {
    const dates = await getAvailableDates('results');
    const latestDate = dates[0] || null;
    let latestSummary = null;

    if (latestDate) {
      latestSummary = await getSummaryForDate(latestDate);
    }

    res.json({
      success: true,
      data: {
        status: 'online',
        version: '1.0.0',
        uptime: process.uptime(),
        latestExecution: latestDate,
        summary: latestSummary,
        connectedClients: wss.clients.size
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get all available dates
app.get('/api/dates', async (req, res) => {
  try {
    const dates = await getAvailableDates('results');

    res.json({
      success: true,
      data: dates
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get all results (latest 30 days)
app.get('/api/results', async (req, res) => {
  try {
    const dates = await getAvailableDates('results');
    // SEC-003: Validate limit parameter
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 30, 1), 365);
    const selectedDates = dates.slice(0, limit);

    const allResults = [];
    for (const date of selectedDates) {
      const results = await getResultsForDate(date);
      allResults.push(...results);
    }

    res.json({
      success: true,
      data: allResults,
      count: allResults.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get results for specific date
app.get('/api/results/:date', async (req, res) => {
  try {
    const { date } = req.params;

    // SEC-003: Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format. Expected YYYY-MM-DD',
        code: 'INVALID_DATE_FORMAT'
      });
    }

    const results = await getResultsForDate(date);

    res.json({
      success: true,
      data: results,
      count: results.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get specific property result
app.get('/api/results/:date/:slug', async (req, res) => {
  try {
    const { date, slug } = req.params;

    // SEC-003: Validate date and slug
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format',
        code: 'INVALID_DATE_FORMAT'
      });
    }

    if (!/^[\w-]+$/.test(slug)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid slug format',
        code: 'INVALID_SLUG_FORMAT'
      });
    }

    // Import supabase dynamically
    const { supabase, Tables } = await import('./utils/supabase.js');

    // Fetch from Supabase with screenshot URL
    // Get the most recent result for this property on this date
    const { data, error } = await supabase
      .from(Tables.CRAWL_RESULTS)
      .select(`
        *,
        properties (
          property_name
        )
      `)
      .eq('property_id', slug)
      .gte('created_at', `${date}T00:00:00Z`)
      .lt('created_at', `${date}T23:59:59Z`)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return res.status(404).json({
        success: false,
        error: 'Result not found'
      });
    }

    // Transform to match expected format
    const result = {
      propertyName: data.properties?.property_name || data.property_id,
      slug: data.property_id,
      validationTime: data.created_at,
      url: data.validation_result?.url,
      measurementId: data.validation_result?.measurementId,
      gtmId: data.validation_result?.gtmId,
      pageViewEvent: data.validation_result?.pageViewEvent,
      apData: data.validation_result?.apData,
      issues: data.validation_result?.issues || [],
      isValid: data.validation_result?.isValid,
      executionTimeMs: data.validation_result?.executionTimeMs,
      pageLoad: data.validation_result?.pageLoad,
      phase: data.validation_result?.phase,
      screenshot_url: data.screenshot_url,
      permanent_screenshot_url: data.permanent_screenshot_url
    };

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error in detail endpoint:', error.message);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get summary for all dates
app.get('/api/summary', async (req, res) => {
  try {
    const dates = await getAvailableDates('results');
    // SEC-003: Validate limit parameter
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 30, 1), 365);
    const selectedDates = dates.slice(0, limit);

    const summaries = [];
    for (const date of selectedDates) {
      const summary = await getSummaryForDate(date);
      if (summary) {
        summaries.push({ date, ...summary });
      }
    }

    res.json({
      success: true,
      data: summaries
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get summary for specific date
app.get('/api/summary/:date', async (req, res) => {
  try {
    const { date } = req.params;

    // SEC-003: Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format. Expected YYYY-MM-DD',
        code: 'INVALID_DATE_FORMAT'
      });
    }

    const summary = await getSummaryForDate(date);

    if (!summary) {
      return res.status(404).json({
        success: false,
        error: 'Summary not found'
      });
    }

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Serve screenshot files
app.get('/api/screenshots/:date/:filename', async (req, res) => {
  try {
    const { date, filename } = req.params;

    // SEC-002: Prevent path traversal - sanitize filename
    const sanitizedFilename = path.basename(filename);

    // SEC-003: Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format',
        code: 'INVALID_DATE_FORMAT'
      });
    }

    // SEC-002: Validate filename format (only allow safe characters and image extensions)
    if (!/^[\w-]+\.(png|jpg|jpeg)$/i.test(sanitizedFilename)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid filename format',
        code: 'INVALID_FILENAME'
      });
    }

    const filePath = path.join('screenshots', date, sanitizedFilename);

    // Check if file exists
    await fs.access(filePath);

    res.sendFile(path.resolve(filePath));
  } catch (error) {
    res.status(404).json({
      success: false,
      error: 'Screenshot not found',
      code: 'NOT_FOUND'
    });
  }
});

// Error handling middleware (REL-001: Structured error responses)
app.use((err, req, res, next) => {
  // Log full error context for debugging
  console.error('Server error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  // Return structured error response
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
    code: err.code || 'INTERNAL_ERROR'
  });
});

// Start server
server.listen(PORT, async () => {
  console.log('\n' + '='.repeat(60));
  console.log('🌐 GA4 Tech Issue Catcher Dashboard');
  console.log('='.repeat(60));
  console.log(`Server: http://localhost:${PORT}`);
  console.log(`WebSocket: ws://localhost:${PORT}/ws`);
  console.log(`Status: http://localhost:${PORT}/api/status`);
  console.log('='.repeat(60) + '\n');

  // Test Supabase connection
  console.log('🔍 Testing Supabase connection...');
  const isConnected = await testConnection();
  if (!isConnected) {
    console.warn('⚠️  Supabase connection failed. Please check your .env configuration.');
    console.warn('   See SUPABASE_SETUP.md for setup instructions.\n');
  }

  // Recover incomplete crawl runs from server restart
  if (isConnected) {
    try {
      await recoverIncompleteCrawls();
    } catch (error) {
      console.warn('⚠️  Startup recovery failed:', error.message);
    }
  }

  // Start automatic cleanup scheduler
  try {
    const cleanupScheduler = getCleanupScheduler();
    cleanupScheduler.start();
    console.log('⏰ Automatic cleanup scheduler started');
  } catch (error) {
    console.warn('⚠️  Failed to start cleanup scheduler:', error.message);
  }

  // Start retry queue scheduler
  try {
    const retryScheduler = getRetryScheduler();
    retryScheduler.start();
  } catch (error) {
    console.warn('⚠️  Failed to start retry scheduler:', error.message);
  }

  console.log('');
});

// Handle shutdown gracefully
process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down server...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

export default { app, server, wss, broadcast };
