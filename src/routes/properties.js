/**
 * Properties API Routes
 *
 * Manages GA4 properties via Supabase.
 */

import express from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { supabase, Tables, PropertyStatus } from '../utils/supabase.js';

const router = express.Router();

// Configure multer for CSV file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

/**
 * GET /api/properties
 * Get all properties with optional filtering
 */
router.get('/', async (req, res) => {
  try {
    const { status, is_active, search, limit = 10000, offset = 0 } = req.query;

    let query = supabase
      .from(Tables.PROPERTIES)
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    // Apply filters
    if (status) {
      query = query.eq('current_status', status);
    }

    if (is_active !== undefined) {
      query = query.eq('is_active', is_active === 'true');
    }

    if (search) {
      query = query.or(`property_name.ilike.%${search}%,url.ilike.%${search}%`);
    }

    // Pagination
    query = query.range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      data: {
        properties: data,
        total: count
      },
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: count
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/properties/summary/stats
 * Get summary statistics for properties
 */
router.get('/summary/stats', async (req, res) => {
  try {
    // Get total count
    const { count: totalCount, error: totalError } = await supabase
      .from(Tables.PROPERTIES)
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    if (totalError) throw totalError;

    // Get latest crawl run to base stats on actual validation results
    const { data: latestRun, error: runError } = await supabase
      .from(Tables.CRAWL_RUNS)
      .select('id')
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    let issueCount = 0;
    let normalCount = 0;
    let debuggingCount = 0;

    if (!runError && latestRun) {
      // Get ALL results for this run to properly handle Phase 1/2 precedence
      const { data: allResults, error: resultsError } = await supabase
        .from(Tables.CRAWL_RESULTS)
        .select('property_id, has_issues, validation_status, phase')
        .eq('crawl_run_id', latestRun.id);

      // Get ALL active properties with their manual status
      const { data: allProperties, error: propsError } = await supabase
        .from(Tables.PROPERTIES)
        .select('id, current_status')
        .eq('is_active', true);

      if (!resultsError && allResults && !propsError && allProperties) {
        // Group validation results by property_id
        const byProperty = {};
        allResults.forEach(r => {
          if (!byProperty[r.property_id]) {
            byProperty[r.property_id] = [];
          }
          byProperty[r.property_id].push(r);
        });

        // Create property status map for manual debugging status
        const propertyStatusMap = {};
        allProperties.forEach(p => {
          propertyStatusMap[p.id] = p.current_status;
        });

        // Apply precedence rule: Manual debugging > Phase 2 > Phase 1
        const issuePropertyIds = new Set();
        const normalPropertyIds = new Set();
        const debuggingPropertyIds = new Set();

        for (const [propertyId, results] of Object.entries(byProperty)) {
          // Check manual debugging status first (highest priority)
          if (propertyStatusMap[propertyId] === 'debugging') {
            debuggingPropertyIds.add(propertyId);
            continue;
          }

          // Apply validation result precedence: Phase 2 > Phase 1
          const phase2 = results.find(r => r.phase === 2);
          const finalResult = phase2 || results[0];

          if (finalResult.has_issues || finalResult.validation_status === 'failed') {
            issuePropertyIds.add(propertyId);
          } else if (finalResult.validation_status === 'passed' && !finalResult.has_issues) {
            normalPropertyIds.add(propertyId);
          }
        }

        issueCount = issuePropertyIds.size;
        normalCount = normalPropertyIds.size;
        debuggingCount = debuggingPropertyIds.size;
      }
    } else {
      // Fallback to manual status if no crawl runs exist
      const { data: statusData, error: statusError } = await supabase
        .from(Tables.PROPERTIES)
        .select('current_status')
        .eq('is_active', true);

      if (statusError) throw statusError;

      const statusCounts = statusData.reduce((acc, prop) => {
        acc[prop.current_status] = (acc[prop.current_status] || 0) + 1;
        return acc;
      }, {});

      issueCount = statusCounts[PropertyStatus.ISSUE] || 0;
      normalCount = statusCounts[PropertyStatus.NORMAL] || 0;
      debuggingCount = statusCounts[PropertyStatus.DEBUGGING] || 0;
    }

    res.json({
      success: true,
      data: {
        total: totalCount,
        normal: normalCount,
        issue: issueCount,
        debugging: debuggingCount
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/properties/download-csv
 * Download all properties as CSV file
 */
router.get('/download-csv', async (req, res) => {
  try {
    // Get all properties
    const { data, error } = await supabase
      .from(Tables.PROPERTIES)
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    // Transform properties to CSV format
    const csvData = data.map(prop => ({
      '계정명': prop.brand || '',
      '속성명': prop.property_name || '',
      'Web Stream Measurement ID': prop.expected_ga4_id || '',
      'Property ID': '', // Not in our schema
      '대표 URLs': prop.url || '',
      'Web GTM Pubilic ID': prop.expected_gtm_id || '',
      'Dataset ID': '', // Not in our schema
      'is_active': prop.is_active ? 'true' : 'false',
      'region': prop.region || '',
      'has_consent_mode': prop.has_consent_mode ? 'true' : 'false' // Story 10.2: Consent Mode support
    }));

    // Convert to CSV string
    const csv = stringify(csvData, {
      header: true,
      quoted: true
    });

    // Set headers for file download
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="properties.csv"');
    res.send('\ufeff' + csv); // Add BOM for Excel UTF-8 support

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/properties/upload-csv
 * Upload CSV file and replace all properties
 */
router.post('/upload-csv', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    // Parse CSV file
    const fileContent = req.file.buffer.toString('utf-8');
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
      bom: true // Handle BOM
    });

    console.log(`📊 Parsed ${records.length} rows from CSV`);

    // Transform records to properties
    const properties = [];
    const seenUrls = new Set();

    for (const record of records) {
      const url = record['대표 URLs']?.trim();
      const propertyName = record['속성명']?.trim();
      const measurementId = record['Web Stream Measurement ID']?.trim();
      const gtmId = record['Web GTM Pubilic ID']?.trim();
      const brand = record['계정명']?.trim();
      const isActive = record['is_active']?.trim() !== 'false'; // Default to true
      const region = record['region']?.trim();
      const hasConsentMode = record['has_consent_mode']?.trim() === 'true'; // Story 10.2: Default to false

      // Skip if missing required fields
      if (!url || !propertyName) {
        continue;
      }

      // Skip duplicates
      if (seenUrls.has(url)) {
        continue;
      }
      seenUrls.add(url);

      // Generate unique slug
      const hash = crypto.createHash('md5').update(url).digest('hex').substring(0, 8);
      const slug = url
        .replace(/^https?:\/\//, '')
        .replace(/\//g, '-')
        .replace(/[^a-z0-9-]/gi, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase()
        .substring(0, 92) + '-' + hash; // 92 + 1 + 8 = 101 chars (under 200 limit)

      properties.push({
        property_name: propertyName,
        url: url,
        slug: slug,
        expected_ga4_id: measurementId || null,
        expected_gtm_id: gtmId || null,
        current_status: PropertyStatus.NORMAL,
        brand: brand || null,
        region: region || null,
        is_active: isActive,
        has_consent_mode: hasConsentMode // Story 10.2: Consent Mode support
      });
    }

    console.log(`✅ Processed ${properties.length} unique properties`);

    // Delete all existing properties
    const { error: deleteError } = await supabase
      .from(Tables.PROPERTIES)
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (deleteError) {
      throw new Error(`Failed to delete properties: ${deleteError.message}`);
    }

    console.log('🗑️  Deleted all existing properties');

    // Insert new properties in batches
    const batchSize = 100;
    let inserted = 0;

    for (let i = 0; i < properties.length; i += batchSize) {
      const batch = properties.slice(i, i + batchSize);

      const { data, error } = await supabase
        .from(Tables.PROPERTIES)
        .insert(batch)
        .select();

      if (error) {
        console.error(`❌ Failed to insert batch: ${error.message}`);
        throw error;
      }

      inserted += data.length;
      console.log(`   ✅ Inserted ${data.length} properties`);
    }

    res.json({
      success: true,
      data: {
        uploaded: records.length,
        inserted: inserted,
        message: `Successfully imported ${inserted} properties`
      }
    });

  } catch (error) {
    console.error('❌ Upload failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/properties
 * Create a new property
 */
router.post('/', async (req, res) => {
  try {
    const {
      property_name,
      url,
      expected_ga4_id,
      expected_gtm_id,
      brand,
      region,
      is_active = true,
      has_consent_mode = false
    } = req.body;

    // Validate required fields
    if (!property_name || !url) {
      return res.status(400).json({
        success: false,
        error: 'property_name and url are required'
      });
    }

    // Validate has_consent_mode type
    if (has_consent_mode !== undefined && typeof has_consent_mode !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'has_consent_mode must be a boolean'
      });
    }

    // Generate slug from URL (max 200 chars for database compatibility)
    const slug = url
      .replace(/^https?:\/\//, '')
      .replace(/\//g, '-')
      .replace(/[^a-z0-9-]/gi, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase()
      .substring(0, 200); // Limit slug length to prevent database issues

    const { data, error } = await supabase
      .from(Tables.PROPERTIES)
      .insert({
        property_name,
        url,
        slug,
        expected_ga4_id,
        expected_gtm_id,
        brand,
        region,
        is_active,
        has_consent_mode,
        current_status: PropertyStatus.NORMAL
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.status(201).json({
      success: true,
      data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/properties/:id/history
 * Get status change history for a property
 */
router.get('/:id/history', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50 } = req.query;

    const { data, error } = await supabase
      .from(Tables.PROPERTY_STATUS_HISTORY)
      .select('*')
      .eq('property_id', id)
      .order('changed_at', { ascending: false })
      .limit(parseInt(limit));

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      data: {
        history: data
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/properties/:id/status
 * Update property status
 */
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes, changed_by = 'user' } = req.body;

    // Validate status
    if (!Object.values(PropertyStatus).includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${Object.values(PropertyStatus).join(', ')}`
      });
    }

    // Update property status
    const { data, error } = await supabase
      .from(Tables.PROPERTIES)
      .update({ current_status: status })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Add notes to status history if provided
    if (notes) {
      await supabase
        .from(Tables.PROPERTY_STATUS_HISTORY)
        .update({ notes })
        .eq('property_id', id)
        .eq('new_status', status)
        .order('changed_at', { ascending: false })
        .limit(1);
    }

    res.json({
      success: true,
      data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/properties/:id
 * Get single property by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from(Tables.PROPERTIES)
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      throw error;
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Property not found'
      });
    }

    res.json({
      success: true,
      data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/properties/:id
 * Update a property (full update)
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      property_name,
      url,
      expected_ga4_id,
      expected_gtm_id,
      brand,
      region,
      is_active,
      has_consent_mode
    } = req.body;

    // Validate has_consent_mode type if provided
    if (has_consent_mode !== undefined && typeof has_consent_mode !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'has_consent_mode must be a boolean'
      });
    }

    // Build update object with only provided fields
    const updates = {};
    if (property_name !== undefined) updates.property_name = property_name;
    if (url !== undefined) {
      updates.url = url;
      // Regenerate slug if URL changed (max 200 chars for database compatibility)
      updates.slug = url
        .replace(/^https?:\/\//, '')
        .replace(/\//g, '-')
        .replace(/[^a-z0-9-]/gi, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase()
        .substring(0, 200); // Limit slug length to prevent database issues
    }
    if (expected_ga4_id !== undefined) updates.expected_ga4_id = expected_ga4_id;
    if (expected_gtm_id !== undefined) updates.expected_gtm_id = expected_gtm_id;
    if (brand !== undefined) updates.brand = brand;
    if (region !== undefined) updates.region = region;
    if (is_active !== undefined) updates.is_active = is_active;
    if (has_consent_mode !== undefined) updates.has_consent_mode = has_consent_mode;

    const { data, error } = await supabase
      .from(Tables.PROPERTIES)
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Property not found'
      });
    }

    res.json({
      success: true,
      data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PATCH /api/properties/:id
 * Partial update of a property (for toggle, quick edits)
 */
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    // Remove fields that shouldn't be updated via PATCH
    delete updates.id;
    delete updates.created_at;
    delete updates.slug; // Slug should only be updated via PUT when URL changes

    const { data, error } = await supabase
      .from(Tables.PROPERTIES)
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Property not found'
      });
    }

    res.json({
      success: true,
      data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/properties/:id
 * Delete a property
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from(Tables.PROPERTIES)
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      message: 'Property deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
