/**
 * Crawler Settings API Routes
 *
 * Handles crawler configuration settings (phase timeouts)
 */

import express from 'express';
import { supabase } from '../utils/supabase.js';

const router = express.Router();

/**
 * GET /api/crawler-settings
 * Get current crawler settings
 */
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('crawler_settings')
      .select('*')
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw error;
    }

    // Return default values if no settings found
    if (!data) {
      return res.json({
        success: true,
        data: {
          phase1_timeout: 20,
          phase2_timeout: 60
        }
      });
    }

    res.json({
      success: true,
      data: {
        phase1_timeout: data.phase1_timeout,
        phase2_timeout: data.phase2_timeout
      }
    });
  } catch (error) {
    console.error('Error fetching crawler settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch crawler settings'
    });
  }
});

/**
 * PUT /api/crawler-settings
 * Update crawler settings
 */
router.put('/', async (req, res) => {
  try {
    const { phase1_timeout, phase2_timeout } = req.body;

    // Validation
    if (!phase1_timeout || !phase2_timeout) {
      return res.status(400).json({
        success: false,
        error: 'phase1_timeout and phase2_timeout are required'
      });
    }

    if (phase1_timeout < 10 || phase1_timeout > 60) {
      return res.status(400).json({
        success: false,
        error: 'phase1_timeout must be between 10 and 60 seconds'
      });
    }

    if (phase2_timeout < 30 || phase2_timeout > 120) {
      return res.status(400).json({
        success: false,
        error: 'phase2_timeout must be between 30 and 120 seconds'
      });
    }

    // Check if settings exist
    const { data: existing } = await supabase
      .from('crawler_settings')
      .select('id')
      .single();

    let result;
    if (existing) {
      // Update existing settings
      result = await supabase
        .from('crawler_settings')
        .update({
          phase1_timeout,
          phase2_timeout,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single();
    } else {
      // Insert new settings
      result = await supabase
        .from('crawler_settings')
        .insert({
          phase1_timeout,
          phase2_timeout
        })
        .select()
        .single();
    }

    if (result.error) {
      throw result.error;
    }

    res.json({
      success: true,
      data: {
        phase1_timeout: result.data.phase1_timeout,
        phase2_timeout: result.data.phase2_timeout
      },
      message: 'Crawler settings updated successfully'
    });
  } catch (error) {
    console.error('Error updating crawler settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update crawler settings'
    });
  }
});

export default router;
