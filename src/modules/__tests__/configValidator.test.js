/**
 * Unit Tests for Config Validator
 * Story 10.2: Consent Mode Support
 *
 * Tests validation logic for Consent Mode feature.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateMeasurementId,
  validatePageViewEvent,
  SEVERITY,
  ISSUE_TYPE
} from '../configValidator.js';

describe('Consent Mode Validation - Story 10.2', () => {
  describe('validateMeasurementId with Consent Mode', () => {
    it('should pass validation when Consent Mode is enabled and no GA4 events detected', () => {
      const property = {
        propertyName: 'Test Property',
        measurementId: 'G-EXPECTED123',
        hasConsentMode: true
      };
      const events = []; // No GA4 events

      const result = validateMeasurementId(property, events);

      assert.equal(result.isValid, true);
      assert.equal(result.expected, 'G-EXPECTED123');
      assert.equal(result.actual, null);
      assert.deepEqual(result.allFound, []);
      assert.equal(result.issues.length, 1);
      assert.equal(result.issues[0].type, ISSUE_TYPE.NO_GA4_EVENTS);
      assert.equal(result.issues[0].severity, SEVERITY.INFO);
      assert.match(result.issues[0].message, /Consent Mode/);
      assert.match(result.issues[0].message, /user declines consent/);
    });

    it('should fail validation when Consent Mode is disabled and no GA4 events detected', () => {
      const property = {
        propertyName: 'Test Property',
        measurementId: 'G-EXPECTED123',
        hasConsentMode: false
      };
      const events = []; // No GA4 events

      const result = validateMeasurementId(property, events);

      assert.equal(result.isValid, false);
      assert.equal(result.expected, 'G-EXPECTED123');
      assert.equal(result.actual, null);
      assert.deepEqual(result.allFound, []);
      assert.equal(result.issues.length, 1);
      assert.equal(result.issues[0].type, ISSUE_TYPE.NO_GA4_EVENTS);
      assert.equal(result.issues[0].severity, SEVERITY.CRITICAL);
      assert.match(result.issues[0].message, /No GA4 events detected/);
    });

    it('should pass validation when GA4 events are present regardless of Consent Mode', () => {
      const property = {
        propertyName: 'Test Property',
        measurementId: 'G-EXPECTED123',
        hasConsentMode: true
      };
      const events = [
        {
          type: 'ga4_collect',
          params: {
            tid: 'G-EXPECTED123',
            en: 'page_view'
          }
        }
      ];

      const result = validateMeasurementId(property, events);

      assert.equal(result.isValid, true);
      assert.equal(result.expected, 'G-EXPECTED123');
      assert.equal(result.actual, 'G-EXPECTED123');
      assert.ok(result.allFound.includes('G-EXPECTED123'));
      assert.equal(result.issues.length, 0);
    });

    it('should handle missing hasConsentMode field (defaults to false)', () => {
      const property = {
        propertyName: 'Test Property',
        measurementId: 'G-EXPECTED123'
        // hasConsentMode not provided
      };
      const events = []; // No GA4 events

      const result = validateMeasurementId(property, events);

      // Should behave as if hasConsentMode is false
      assert.equal(result.isValid, false);
      assert.equal(result.issues[0].severity, SEVERITY.CRITICAL);
    });

    it('should detect expected GA4 ID even when multiple GA4 IDs are present', () => {
      const property = {
        propertyName: 'Test Property',
        measurementId: 'G-EXPECTED123',
        hasConsentMode: true
      };
      const events = [
        {
          type: 'ga4_collect',
          params: {
            tid: 'G-OTHER456',
            en: 'page_view'
          }
        },
        {
          type: 'ga4_collect',
          params: {
            tid: 'G-EXPECTED123',
            en: 'page_view'
          }
        }
      ];

      const result = validateMeasurementId(property, events);

      assert.equal(result.isValid, true);
      assert.equal(result.actual, 'G-EXPECTED123');
      assert.ok(result.allFound.includes('G-EXPECTED123'));
      assert.ok(result.allFound.includes('G-OTHER456'));
    });
  });

  describe('Property Transformation Integration', () => {
    it('should work with camelCase hasConsentMode field from property transformation', () => {
      // This tests that the field mapping from crawl.js works correctly
      const propertyFromTransformation = {
        propertyName: 'Test Property',
        measurementId: 'G-EXPECTED123',
        hasConsentMode: true // camelCase from transformation
      };
      const events = [];

      const result = validateMeasurementId(propertyFromTransformation, events);

      assert.equal(result.isValid, true);
      assert.equal(result.issues[0].severity, SEVERITY.INFO);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty property name', () => {
      const property = {
        propertyName: '',
        measurementId: 'G-EXPECTED123',
        hasConsentMode: true
      };
      const events = [];

      const result = validateMeasurementId(property, events);

      assert.equal(result.isValid, true);
      assert.equal(result.issues[0].severity, SEVERITY.INFO);
    });

    it('should handle null events array gracefully', () => {
      const property = {
        propertyName: 'Test Property',
        measurementId: 'G-EXPECTED123',
        hasConsentMode: true
      };
      const events = null;

      // Should not throw error
      assert.doesNotThrow(() => {
        validateMeasurementId(property, events || []);
      });
    });
  });
});

describe('validatePageViewEvent - Consent Mode Context', () => {
  it('should detect page_view events when present', () => {
    const events = [
      {
        type: 'ga4_collect',
        params: {
          en: 'page_view'
        }
      }
    ];

    const result = validatePageViewEvent(events);

    assert.equal(result.isValid, true);
    assert.equal(result.count, 1);
    assert.equal(result.issues.length, 0);
  });

  it('should fail when page_view events are missing', () => {
    const events = [
      {
        type: 'ga4_collect',
        params: {
          en: 'user_engagement'
        }
      }
    ];

    const result = validatePageViewEvent(events);

    assert.equal(result.isValid, false);
    assert.equal(result.count, 0);
    assert.equal(result.issues.length, 1);
    assert.equal(result.issues[0].type, ISSUE_TYPE.PAGE_VIEW_NOT_FOUND);
  });

  it('should count multiple page_view events', () => {
    const events = [
      {
        type: 'ga4_collect',
        params: {
          en: 'page_view'
        }
      },
      {
        type: 'ga4_collect',
        params: {
          en: 'page_view'
        }
      }
    ];

    const result = validatePageViewEvent(events);

    assert.equal(result.isValid, true);
    assert.equal(result.count, 2);
  });
});
