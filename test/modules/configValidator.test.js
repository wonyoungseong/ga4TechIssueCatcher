/**
 * Configuration Validator Module Tests
 *
 * Tests for GA4/GTM configuration validation
 *
 * Epic 3: GA4/GTM Configuration Validation
 * Story 3.3: GTM Container ID Validation
 */

import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateMeasurementId,
  validateGTMIdFromHTML,
  validatePageViewEvent,
  SEVERITY,
  ISSUE_TYPE
} from '../../src/modules/configValidator.js';

describe('validateGTMIdFromHTML - Story 3.3', () => {
  let mockPage;

  beforeEach(() => {
    // Create mock page object
    mockPage = {
      content: mock.fn()
    };
  });

  describe('AC1, AC2: GTM Detection from HTML', () => {
    it('should extract GTM ID from HTML content using regex', async () => {
      // Arrange
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
          new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
          j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
          'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
          })(window,document,'script','dataLayer','GTM-ABC1234');</script>
        </head>
        <body></body>
        </html>
      `;
      mockPage.content.mock.mockImplementation(() => Promise.resolve(htmlContent));
      const expectedGtmId = 'GTM-ABC1234';

      // Act
      const result = await validateGTMIdFromHTML(mockPage, expectedGtmId);

      // Assert
      assert.strictEqual(result.isValid, true, 'Should validate successfully');
      assert.strictEqual(result.actualId, expectedGtmId, 'Should extract correct GTM ID');
      assert.strictEqual(result.issues.length, 0, 'Should have no issues');
    });

    it('should extract GTM ID with uppercase letters and numbers', async () => {
      // Arrange
      const htmlContent = '<script src="https://www.googletagmanager.com/gtm.js?id=GTM-WXYZ789"></script>';
      mockPage.content.mock.mockImplementation(() => Promise.resolve(htmlContent));
      const expectedGtmId = 'GTM-WXYZ789';

      // Act
      const result = await validateGTMIdFromHTML(mockPage, expectedGtmId);

      // Assert
      assert.strictEqual(result.actualId, 'GTM-WXYZ789', 'Should extract GTM ID with mixed characters');
    });

    it('should match regex pattern GTM-[A-Z0-9]{6,}', async () => {
      // Arrange
      const htmlContent = '<script>GTM-123456</script>';
      mockPage.content.mock.mockImplementation(() => Promise.resolve(htmlContent));

      // Act
      const result = await validateGTMIdFromHTML(mockPage, 'GTM-123456');

      // Assert
      assert.strictEqual(result.actualId, 'GTM-123456', 'Should match minimum 6 characters');
    });
  });

  describe('AC3: GTM ID Comparison', () => {
    it('should validate when actual GTM ID matches expected ID', async () => {
      // Arrange
      const htmlContent = '<script>GTM-TEST123</script>';
      mockPage.content.mock.mockImplementation(() => Promise.resolve(htmlContent));
      const expectedGtmId = 'GTM-TEST123';

      // Act
      const result = await validateGTMIdFromHTML(mockPage, expectedGtmId);

      // Assert
      assert.strictEqual(result.isValid, true, 'Should be valid when IDs match');
      assert.strictEqual(result.actualId, expectedGtmId);
      assert.strictEqual(result.issues.length, 0);
    });

    it('should pass validation result in JSON format (AC6)', async () => {
      // Arrange
      const htmlContent = '<script>GTM-JSON123</script>';
      mockPage.content.mock.mockImplementation(() => Promise.resolve(htmlContent));

      // Act
      const result = await validateGTMIdFromHTML(mockPage, 'GTM-JSON123');

      // Assert
      assert.strictEqual(typeof result, 'object', 'Should return object');
      assert.ok('isValid' in result, 'Should have isValid property');
      assert.ok('actualId' in result, 'Should have actualId property');
      assert.ok('issues' in result, 'Should have issues property');
    });
  });

  describe('AC4: GTM ID Mismatch Detection', () => {
    it('should detect GTM ID mismatch', async () => {
      // Arrange
      const htmlContent = '<script>GTM-WRONG123</script>';
      mockPage.content.mock.mockImplementation(() => Promise.resolve(htmlContent));
      const expectedGtmId = 'GTM-CORRECT456';

      // Act
      const result = await validateGTMIdFromHTML(mockPage, expectedGtmId);

      // Assert
      assert.strictEqual(result.isValid, false, 'Should be invalid when IDs mismatch');
      assert.strictEqual(result.actualId, 'GTM-WRONG123');
      assert.strictEqual(result.issues.length, 1, 'Should have one issue');
    });

    it('should create GTM_ID_MISMATCH issue with critical severity', async () => {
      // Arrange
      const htmlContent = '<script>GTM-ACTUAL</script>';
      mockPage.content.mock.mockImplementation(() => Promise.resolve(htmlContent));

      // Act
      const result = await validateGTMIdFromHTML(mockPage, 'GTM-EXPECTED');

      // Assert
      const issue = result.issues[0];
      assert.strictEqual(issue.type, 'GTM_ID_MISMATCH', 'Should have correct issue type');
      assert.strictEqual(issue.severity, 'critical', 'Should have critical severity');
      assert.strictEqual(issue.expected, 'GTM-EXPECTED');
      assert.strictEqual(issue.actual, 'GTM-ACTUAL');
      assert.ok(issue.message.includes('mismatch'), 'Should have mismatch message');
      assert.ok(issue.timestamp, 'Should have timestamp');
    });
  });

  describe('AC5: No GTM Script Detection', () => {
    it('should detect when no GTM script is present', async () => {
      // Arrange
      const htmlContent = '<html><body><h1>No GTM here</h1></body></html>';
      mockPage.content.mock.mockImplementation(() => Promise.resolve(htmlContent));

      // Act
      const result = await validateGTMIdFromHTML(mockPage, 'GTM-EXPECTED123');

      // Assert
      assert.strictEqual(result.isValid, false, 'Should be invalid when no GTM found');
      assert.strictEqual(result.actualId, null, 'Should have null actualId');
      assert.strictEqual(result.issues.length, 1, 'Should have one issue');
    });

    it('should create GTM_NOT_FOUND issue with critical severity', async () => {
      // Arrange
      const htmlContent = '<html></html>';
      mockPage.content.mock.mockImplementation(() => Promise.resolve(htmlContent));

      // Act
      const result = await validateGTMIdFromHTML(mockPage, 'GTM-TEST123');

      // Assert
      const issue = result.issues[0];
      assert.strictEqual(issue.type, 'GTM_NOT_FOUND', 'Should have GTM_NOT_FOUND type');
      assert.strictEqual(issue.severity, 'critical', 'Should have critical severity');
      assert.strictEqual(issue.expected, 'GTM-TEST123');
      assert.strictEqual(issue.actual, null);
      assert.ok(issue.message.includes('No GTM'), 'Should have no GTM message');
      assert.ok(issue.timestamp, 'Should have timestamp');
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple GTM IDs and use first match', async () => {
      // Arrange
      const htmlContent = `
        <script>GTM-FIRST123</script>
        <script>GTM-SECOND456</script>
      `;
      mockPage.content.mock.mockImplementation(() => Promise.resolve(htmlContent));

      // Act
      const result = await validateGTMIdFromHTML(mockPage, 'GTM-FIRST123');

      // Assert
      assert.strictEqual(result.actualId, 'GTM-FIRST123', 'Should use first GTM ID found');
      assert.strictEqual(result.isValid, true);
    });

    it('should handle empty HTML', async () => {
      // Arrange
      mockPage.content.mock.mockImplementation(() => Promise.resolve(''));

      // Act
      const result = await validateGTMIdFromHTML(mockPage, 'GTM-TEST123');

      // Assert
      assert.strictEqual(result.isValid, false);
      assert.strictEqual(result.actualId, null);
      assert.strictEqual(result.issues[0].type, 'GTM_NOT_FOUND');
    });

    it('should handle GTM ID in noscript tag', async () => {
      // Arrange
      const htmlContent = `
        <noscript>
          <iframe src="https://www.googletagmanager.com/ns.html?id=GTM-NOSCRIPT123"></iframe>
        </noscript>
      `;
      mockPage.content.mock.mockImplementation(() => Promise.resolve(htmlContent));

      // Act
      const result = await validateGTMIdFromHTML(mockPage, 'GTM-NOSCRIPT123');

      // Assert
      assert.strictEqual(result.actualId, 'GTM-NOSCRIPT123');
      assert.strictEqual(result.isValid, true);
    });

    it('should handle GTM ID with longer alphanumeric suffix', async () => {
      // Arrange
      const htmlContent = '<script>GTM-ABCD1234567890</script>';
      mockPage.content.mock.mockImplementation(() => Promise.resolve(htmlContent));

      // Act
      const result = await validateGTMIdFromHTML(mockPage, 'GTM-ABCD1234567890');

      // Assert
      assert.strictEqual(result.actualId, 'GTM-ABCD1234567890', 'Should handle longer IDs');
      assert.strictEqual(result.isValid, true);
    });

    it('should reject invalid GTM ID format (too short)', async () => {
      // Arrange
      const htmlContent = '<script>GTM-ABC12</script>'; // Only 5 chars after GTM-
      mockPage.content.mock.mockImplementation(() => Promise.resolve(htmlContent));

      // Act
      const result = await validateGTMIdFromHTML(mockPage, 'GTM-EXPECTED');

      // Assert
      // Pattern requires minimum 6 characters, so GTM-ABC12 won't match
      assert.strictEqual(result.isValid, false);
      assert.strictEqual(result.issues[0].type, 'GTM_NOT_FOUND');
    });

    it('should handle special characters in HTML without breaking', async () => {
      // Arrange
      const htmlContent = `
        <script>
          var data = "GTM-TEST123";
          var special = '<>&"';
        </script>
      `;
      mockPage.content.mock.mockImplementation(() => Promise.resolve(htmlContent));

      // Act
      const result = await validateGTMIdFromHTML(mockPage, 'GTM-TEST123');

      // Assert
      assert.strictEqual(result.actualId, 'GTM-TEST123');
      assert.strictEqual(result.isValid, true);
    });
  });

  describe('Return Value Structure (AC6)', () => {
    it('should return correct structure for valid case', async () => {
      // Arrange
      const htmlContent = '<script>GTM-VALID123</script>';
      mockPage.content.mock.mockImplementation(() => Promise.resolve(htmlContent));

      // Act
      const result = await validateGTMIdFromHTML(mockPage, 'GTM-VALID123');

      // Assert
      assert.deepStrictEqual(
        Object.keys(result).sort(),
        ['isValid', 'actualId', 'issues'].sort(),
        'Should have correct keys'
      );
      assert.strictEqual(typeof result.isValid, 'boolean');
      assert.strictEqual(typeof result.actualId, 'string');
      assert.ok(Array.isArray(result.issues));
    });

    it('should return correct structure for invalid case', async () => {
      // Arrange
      const htmlContent = '';
      mockPage.content.mock.mockImplementation(() => Promise.resolve(htmlContent));

      // Act
      const result = await validateGTMIdFromHTML(mockPage, 'GTM-TEST123');

      // Assert
      assert.strictEqual(result.isValid, false);
      assert.strictEqual(result.actualId, null);
      assert.ok(Array.isArray(result.issues));
      assert.strictEqual(result.issues.length, 1);
    });
  });
});

/**
 * Story 3.2: Measurement ID Validation Tests
 * Tests for validateMeasurementId function
 */
describe('validateMeasurementId - Story 3.2', () => {
  describe('AC1: Extract Measurement ID from Events', () => {
    it('should extract measurement ID from captured GA4 events', () => {
      // Arrange
      const property = { measurementId: 'G-ABC1234567' };
      const events = [
        {
          type: 'ga4_collect',
          url: 'https://www.google-analytics.com/g/collect?v=2&tid=G-ABC1234567&en=page_view',
          params: { tid: 'G-ABC1234567', en: 'page_view' }
        }
      ];

      // Act
      const result = validateMeasurementId(property, events);

      // Assert
      assert.strictEqual(result.isValid, true, 'Should validate successfully');
      assert.strictEqual(result.actual, 'G-ABC1234567', 'Should extract correct measurement ID');
      assert.strictEqual(result.expected, 'G-ABC1234567');
      assert.strictEqual(result.issues.length, 0, 'Should have no issues');
    });

    it('should extract measurement ID from multiple events (use first)', () => {
      // Arrange
      const property = { measurementId: 'G-TEST12345' };
      const events = [
        {
          type: 'ga4_collect',
          url: 'https://www.google-analytics.com/g/collect?v=2&tid=G-TEST12345&en=page_view',
          params: { tid: 'G-TEST12345', en: 'page_view' }
        },
        {
          type: 'ga4_collect',
          url: 'https://www.google-analytics.com/g/collect?v=2&tid=G-TEST12345&en=click',
          params: { tid: 'G-TEST12345', en: 'click' }
        }
      ];

      // Act
      const result = validateMeasurementId(property, events);

      // Assert
      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.actual, 'G-TEST12345');
    });
  });

  describe('AC2, AC3: Measurement ID Comparison and Mismatch Detection', () => {
    it('should validate when actual measurement ID matches expected ID', () => {
      // Arrange
      const property = { measurementId: 'G-MATCH12345' };
      const events = [
        {
          type: 'ga4_collect',
          url: 'https://www.google-analytics.com/g/collect?v=2&tid=G-MATCH12345&en=page_view',
          params: { tid: 'G-MATCH12345', en: 'page_view' }
        }
      ];

      // Act
      const result = validateMeasurementId(property, events);

      // Assert
      assert.strictEqual(result.isValid, true, 'Should be valid when IDs match');
      assert.strictEqual(result.actual, 'G-MATCH12345');
      assert.strictEqual(result.expected, 'G-MATCH12345');
      assert.strictEqual(result.issues.length, 0);
    });

    it('should detect measurement ID mismatch', () => {
      // Arrange
      const property = { measurementId: 'G-EXPECTED12' };
      const events = [
        {
          type: 'ga4_collect',
          url: 'https://www.google-analytics.com/g/collect?v=2&tid=G-WRONGONE12&en=page_view',
          params: { tid: 'G-WRONGONE12', en: 'page_view' }
        }
      ];

      // Act
      const result = validateMeasurementId(property, events);

      // Assert
      assert.strictEqual(result.isValid, false, 'Should be invalid when IDs mismatch');
      assert.strictEqual(result.actual, 'G-WRONGONE12');
      assert.strictEqual(result.expected, 'G-EXPECTED12');
      assert.strictEqual(result.issues.length, 1, 'Should have one issue');
    });

    it('should create MEASUREMENT_ID_MISMATCH issue with critical severity', () => {
      // Arrange
      const property = { measurementId: 'G-EXPECTED99' };
      const events = [
        {
          type: 'ga4_collect',
          url: 'https://www.google-analytics.com/g/collect?v=2&tid=G-ACTUAL9999&en=page_view',
          params: { tid: 'G-ACTUAL9999', en: 'page_view' }
        }
      ];

      // Act
      const result = validateMeasurementId(property, events);

      // Assert
      const issue = result.issues[0];
      assert.strictEqual(issue.type, 'MEASUREMENT_ID_MISMATCH', 'Should have correct issue type');
      assert.strictEqual(issue.severity, 'critical', 'Should have critical severity');
      assert.strictEqual(issue.expected, 'G-EXPECTED99');
      assert.strictEqual(issue.actual, 'G-ACTUAL9999');
      assert.ok(issue.message.includes('mismatch'), 'Should have mismatch message');
    });
  });

  describe('AC4: No Measurement ID Detected', () => {
    it('should detect when no measurement ID is found (empty events)', () => {
      // Arrange
      const property = { measurementId: 'G-EXPECTED00' };
      const events = [];

      // Act
      const result = validateMeasurementId(property, events);

      // Assert
      assert.strictEqual(result.isValid, false, 'Should be invalid when no measurement ID found');
      assert.strictEqual(result.actual, null, 'Should have null actualId');
      assert.strictEqual(result.issues.length, 1, 'Should have one issue');
    });

    it('should detect when events have no GA4 data', () => {
      // Arrange
      const property = { measurementId: 'G-TEST00000' };
      const events = [
        {
          type: 'other_event',
          url: 'https://example.com',
          params: {}
        }
      ];

      // Act
      const result = validateMeasurementId(property, events);

      // Assert
      assert.strictEqual(result.isValid, false);
      assert.strictEqual(result.actual, null);
      assert.strictEqual(result.issues[0].type, 'NO_GA4_EVENTS');
    });

    it('should create NO_GA4_EVENTS issue with critical severity', () => {
      // Arrange
      const property = { measurementId: 'G-NONE00000' };
      const events = [];

      // Act
      const result = validateMeasurementId(property, events);

      // Assert
      const issue = result.issues[0];
      assert.strictEqual(issue.type, 'NO_GA4_EVENTS', 'Should have NO_GA4_EVENTS type');
      assert.strictEqual(issue.severity, 'critical', 'Should have critical severity');
      assert.strictEqual(issue.expected, 'G-NONE00000');
      assert.strictEqual(issue.actual, null);
      assert.ok(issue.message.includes('No GA4'), 'Should have no GA4 message');
    });
  });

  describe('AC5: Return Value Structure', () => {
    it('should return correct structure for valid case', () => {
      // Arrange
      const property = { measurementId: 'G-STRUCT123' };
      const events = [
        {
          type: 'ga4_collect',
          url: 'https://www.google-analytics.com/g/collect?v=2&tid=G-STRUCT123&en=page_view',
          params: { tid: 'G-STRUCT123', en: 'page_view' }
        }
      ];

      // Act
      const result = validateMeasurementId(property, events);

      // Assert
      assert.deepStrictEqual(
        Object.keys(result).sort(),
        ['isValid', 'expected', 'actual', 'issues'].sort(),
        'Should have correct keys'
      );
      assert.strictEqual(typeof result.isValid, 'boolean');
      assert.strictEqual(typeof result.expected, 'string');
      assert.strictEqual(typeof result.actual, 'string');
      assert.ok(Array.isArray(result.issues));
    });

    it('should return correct structure for invalid case', () => {
      // Arrange
      const property = { measurementId: 'G-INVALID00' };
      const events = [];

      // Act
      const result = validateMeasurementId(property, events);

      // Assert
      assert.strictEqual(result.isValid, false);
      assert.strictEqual(result.actual, null);
      assert.ok(Array.isArray(result.issues));
      assert.strictEqual(result.issues.length, 1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle events without measurement ID params', () => {
      // Arrange
      const property = { measurementId: 'G-EDGE00000' };
      const events = [
        {
          type: 'ga4_collect',
          url: 'https://www.google-analytics.com/g/collect?v=2&en=page_view',
          params: { en: 'page_view' } // Missing tid
        }
      ];

      // Act
      const result = validateMeasurementId(property, events);

      // Assert
      assert.strictEqual(result.isValid, false);
      assert.strictEqual(result.actual, null);
      assert.strictEqual(result.issues[0].type, 'NO_GA4_EVENTS');
    });

    it('should handle mixed event types (filter GA4 only)', () => {
      // Arrange
      const property = { measurementId: 'G-MIXED0000' };
      const events = [
        {
          type: 'other_type',
          url: 'https://example.com',
          params: {}
        },
        {
          type: 'ga4_collect',
          url: 'https://www.google-analytics.com/g/collect?v=2&tid=G-MIXED0000&en=page_view',
          params: { tid: 'G-MIXED0000', en: 'page_view' }
        }
      ];

      // Act
      const result = validateMeasurementId(property, events);

      // Assert
      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.actual, 'G-MIXED0000');
    });
  });
});

/**
 * Story 3.4: page_view Event Validation Tests
 * Tests for validatePageViewEvent function
 */
describe('validatePageViewEvent - Story 3.4', () => {
  describe('AC1, AC2: page_view Event Detection and Count', () => {
    it('should detect single page_view event (count = 1)', () => {
      // Arrange
      const events = [
        {
          type: 'ga4_collect',
          params: { tid: 'G-TEST123', en: 'page_view' }
        }
      ];

      // Act
      const result = validatePageViewEvent(events);

      // Assert
      assert.strictEqual(result.isValid, true, 'Should be valid when page_view found');
      assert.strictEqual(result.count, 1, 'Should count exactly 1 page_view event');
      assert.strictEqual(result.issues.length, 0, 'Should have no issues');
    });

    it('should detect multiple page_view events (count > 1)', () => {
      // Arrange
      const events = [
        {
          type: 'ga4_collect',
          params: { tid: 'G-TEST123', en: 'page_view' }
        },
        {
          type: 'ga4_collect',
          params: { tid: 'G-TEST123', en: 'page_view' }
        },
        {
          type: 'ga4_collect',
          params: { tid: 'G-TEST123', en: 'page_view' }
        }
      ];

      // Act
      const result = validatePageViewEvent(events);

      // Assert
      assert.strictEqual(result.isValid, true, 'Should be valid when page_view events found');
      assert.strictEqual(result.count, 3, 'Should count all 3 page_view events');
      assert.strictEqual(result.issues.length, 0, 'Should have no issues');
    });
  });

  describe('AC3: page_view Event Missing Detection', () => {
    it('should detect when no page_view event exists (count = 0)', () => {
      // Arrange
      const events = [];

      // Act
      const result = validatePageViewEvent(events);

      // Assert
      assert.strictEqual(result.isValid, false, 'Should be invalid when no page_view found');
      assert.strictEqual(result.count, 0, 'Should count 0 page_view events');
      assert.strictEqual(result.issues.length, 1, 'Should have one issue');

      const issue = result.issues[0];
      assert.strictEqual(issue.type, 'PAGE_VIEW_NOT_FOUND', 'Should have PAGE_VIEW_NOT_FOUND type');
      assert.strictEqual(issue.severity, 'critical', 'Should have critical severity');
      assert.ok(issue.message.includes('No page_view event detected'), 'Should have appropriate message');
    });

    it('should detect when other events exist but no page_view', () => {
      // Arrange
      const events = [
        {
          type: 'ga4_collect',
          params: { tid: 'G-TEST123', en: 'click' }
        },
        {
          type: 'ga4_collect',
          params: { tid: 'G-TEST123', en: 'scroll' }
        }
      ];

      // Act
      const result = validatePageViewEvent(events);

      // Assert
      assert.strictEqual(result.isValid, false, 'Should be invalid when no page_view found');
      assert.strictEqual(result.count, 0, 'Should count 0 page_view events');
      assert.strictEqual(result.issues.length, 1, 'Should have one issue');
      assert.strictEqual(result.issues[0].type, 'PAGE_VIEW_NOT_FOUND');
    });
  });

  describe('AC4: Mixed Events with page_view', () => {
    it('should correctly count page_view events in mixed event array', () => {
      // Arrange
      const events = [
        {
          type: 'ga4_collect',
          params: { tid: 'G-TEST123', en: 'page_view' }
        },
        {
          type: 'ga4_collect',
          params: { tid: 'G-TEST123', en: 'click' }
        },
        {
          type: 'ga4_collect',
          params: { tid: 'G-TEST123', en: 'scroll' }
        },
        {
          type: 'ga4_collect',
          params: { tid: 'G-TEST123', en: 'page_view' }
        }
      ];

      // Act
      const result = validatePageViewEvent(events);

      // Assert
      assert.strictEqual(result.isValid, true, 'Should be valid when page_view events found');
      assert.strictEqual(result.count, 2, 'Should count only page_view events (2 out of 4)');
      assert.strictEqual(result.issues.length, 0, 'Should have no issues');
    });
  });

  describe('ValidationResult Structure (AC4)', () => {
    it('should return correct structure for valid case', () => {
      // Arrange
      const events = [
        {
          type: 'ga4_collect',
          params: { tid: 'G-TEST123', en: 'page_view' }
        }
      ];

      // Act
      const result = validatePageViewEvent(events);

      // Assert
      assert.ok('isValid' in result, 'Should have isValid property');
      assert.ok('count' in result, 'Should have count property');
      assert.ok('issues' in result, 'Should have issues property');
      assert.strictEqual(typeof result.isValid, 'boolean', 'isValid should be boolean');
      assert.strictEqual(typeof result.count, 'number', 'count should be number');
      assert.ok(Array.isArray(result.issues), 'issues should be array');
    });

    it('should return correct structure for invalid case', () => {
      // Arrange
      const events = [];

      // Act
      const result = validatePageViewEvent(events);

      // Assert
      assert.strictEqual(result.isValid, false);
      assert.strictEqual(result.count, 0);
      assert.ok(Array.isArray(result.issues));
      assert.strictEqual(result.issues.length, 1);

      const issue = result.issues[0];
      assert.ok('type' in issue, 'Issue should have type');
      assert.ok('severity' in issue, 'Issue should have severity');
      assert.ok('message' in issue, 'Issue should have message');
      assert.ok('expected' in issue, 'Issue should have expected');
      assert.ok('actual' in issue, 'Issue should have actual');
    });
  });
});
