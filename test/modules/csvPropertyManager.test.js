/**
 * Unit Tests for CSV Property Manager
 *
 * Story 1.1: CSV File Load and Parsing
 * Tests loadPropertiesFromCSV() function with various scenarios
 */

import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  loadPropertiesFromCSV,
  findPropertyByMeasurementId,
  filterPropertiesByAccount,
  validateCSVFile,
  detectPropertyChanges,
  loadPreviousProperties,
  savePreviousProperties
} from '../../src/modules/csvPropertyManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_DATA_DIR = path.join(__dirname, '../fixtures');

/**
 * Test CSV content templates
 */
const VALID_CSV = `계정명,속성명,WebStream Measurement ID,사이트 유형,대표 URLs,웹/앱 여부,Web GTM Pubilic ID,Android GTM Pubilic ID,iOS GTM Pubilic ID,Dataset ID,마케팅 GTM,whitelist
아모레퍼시픽,AMOREMALL KR,G-ABC1234567,EC,https://www.amoremall.com,웹,GTM-XXXXXX,,,dataset-001,,"domain1.com,domain2.com"
아모레퍼시픽,INNISFREE,G-DEF9876543,브랜드,https://www.innisfree.com,웹,GTM-YYYYYY,,,dataset-002,,
아모레퍼시픽,ETUDE,G-GHI5555555,브랜드,https://www.etude.com,웹,GTM-ZZZZZZ,,,dataset-003,,`;

const EMPTY_CSV = `계정명,속성명,WebStream Measurement ID,사이트 유형,대표 URLs,웹/앱 여부,Web GTM Pubilic ID,Android GTM Pubilic ID,iOS GTM Pubilic ID,Dataset ID,마케팅 GTM,whitelist
`;

const CSV_WITH_INVALID_ROWS = `계정명,속성명,WebStream Measurement ID,사이트 유형,대표 URLs,웹/앱 여부,Web GTM Pubilic ID,Android GTM Pubilic ID,iOS GTM Pubilic ID,Dataset ID,마케팅 GTM,whitelist
아모레퍼시픽,AMOREMALL KR,G-ABC1234567,EC,https://www.amoremall.com,웹,GTM-XXXXXX,,,dataset-001,,
,,,-,-,,,,,,,
아모레퍼시픽,TEST Property,G-TEST123456,브랜드,https://test.com,웹,GTM-TEST,,,,,
,INNISFREE,G-DEF9876543,브랜드,-,웹,GTM-YYYYYY,,,,,
아모레퍼시픽,ETUDE,G-GHI5555555,브랜드,https://www.etude.com,웹,GTM-ZZZZZZ,,,dataset-003,,`;

const CSV_WITH_KOREAN_COLUMNS = `계정명,속성명,WebStream Measurement ID,사이트 유형,대표 URLs,웹/앱 여부,Web GTM Pubilic ID
아모레퍼시픽,한글속성명,G-KOR1234567,브랜드,https://korean.com,웹,GTM-KOREA`;

const CSV_WITH_COMMENTS = `# This is a comment
계정명,속성명,WebStream Measurement ID,사이트 유형,대표 URLs,웹/앱 여부,Web GTM Pubilic ID
# Another comment
아모레퍼시픽,AMOREMALL KR,G-ABC1234567,EC,https://www.amoremall.com,웹,GTM-XXXXXX`;

/**
 * Setup test fixtures
 */
async function setupTestFixtures() {
  await fs.mkdir(TEST_DATA_DIR, { recursive: true });

  await fs.writeFile(
    path.join(TEST_DATA_DIR, 'valid.csv'),
    VALID_CSV,
    'utf-8'
  );

  await fs.writeFile(
    path.join(TEST_DATA_DIR, 'empty.csv'),
    EMPTY_CSV,
    'utf-8'
  );

  await fs.writeFile(
    path.join(TEST_DATA_DIR, 'invalid-rows.csv'),
    CSV_WITH_INVALID_ROWS,
    'utf-8'
  );

  await fs.writeFile(
    path.join(TEST_DATA_DIR, 'korean.csv'),
    CSV_WITH_KOREAN_COLUMNS,
    'utf-8'
  );

  await fs.writeFile(
    path.join(TEST_DATA_DIR, 'comments.csv'),
    CSV_WITH_COMMENTS,
    'utf-8'
  );

  // Create a file with UTF-8 special characters
  await fs.writeFile(
    path.join(TEST_DATA_DIR, 'utf8-special.csv'),
    `계정명,속성명,WebStream Measurement ID,사이트 유형,대표 URLs,웹/앱 여부,Web GTM Pubilic ID
아모레퍼시픽,특수문자™®©,G-UTF8123456,브랜드,https://특수문자.com,웹,GTM-UTF8`,
    'utf-8'
  );
}

/**
 * Cleanup test fixtures
 */
async function cleanupTestFixtures() {
  try {
    await fs.rm(TEST_DATA_DIR, { recursive: true, force: true });
  } catch (error) {
    // Ignore cleanup errors
  }
}

describe('CSV Property Manager', () => {
  before(async () => {
    await setupTestFixtures();
  });

  after(async () => {
    await cleanupTestFixtures();
  });

  describe('loadPropertiesFromCSV()', () => {
    it('should load valid CSV with multiple properties', async () => {
      const csvPath = path.join(TEST_DATA_DIR, 'valid.csv');
      const properties = await loadPropertiesFromCSV(csvPath);

      assert.equal(properties.length, 3);
      assert.equal(properties[0].measurementId, 'G-ABC1234567');
      assert.equal(properties[0].propertyName, 'AMOREMALL KR');
      assert.equal(properties[0].accountName, '아모레퍼시픽');
      assert.equal(properties[0].representativeUrl, 'https://www.amoremall.com');
      assert.equal(properties[0].webGtmId, 'GTM-XXXXXX');
    });

    it('should throw error for missing CSV file', async () => {
      const csvPath = path.join(TEST_DATA_DIR, 'nonexistent.csv');

      await assert.rejects(
        async () => await loadPropertiesFromCSV(csvPath),
        {
          name: 'Error',
          message: /CSV file not found/
        }
      );
    });

    it('should handle empty CSV file', async () => {
      const csvPath = path.join(TEST_DATA_DIR, 'empty.csv');
      const properties = await loadPropertiesFromCSV(csvPath);

      assert.equal(properties.length, 0);
    });

    it('should skip invalid rows', async () => {
      const csvPath = path.join(TEST_DATA_DIR, 'invalid-rows.csv');
      const properties = await loadPropertiesFromCSV(csvPath);

      // Should only load the first and last valid rows
      // Skips: empty row, test property, row with missing representativeUrl
      assert.equal(properties.length, 2);
      assert.equal(properties[0].measurementId, 'G-ABC1234567');
      assert.equal(properties[1].measurementId, 'G-GHI5555555');
    });

    it('should handle Korean column names', async () => {
      const csvPath = path.join(TEST_DATA_DIR, 'korean.csv');
      const properties = await loadPropertiesFromCSV(csvPath);

      assert.equal(properties.length, 1);
      assert.equal(properties[0].propertyName, '한글속성명');
      assert.equal(properties[0].measurementId, 'G-KOR1234567');
    });

    it('should handle UTF-8 encoding with special characters', async () => {
      const csvPath = path.join(TEST_DATA_DIR, 'utf8-special.csv');
      const properties = await loadPropertiesFromCSV(csvPath);

      assert.equal(properties.length, 1);
      assert.equal(properties[0].propertyName, '특수문자™®©');
      assert.equal(properties[0].representativeUrl, 'https://특수문자.com');
    });

    it('should parse whitelist domains into array', async () => {
      const csvPath = path.join(TEST_DATA_DIR, 'valid.csv');
      const properties = await loadPropertiesFromCSV(csvPath);

      const propertyWithWhitelist = properties[0];
      assert.ok(Array.isArray(propertyWithWhitelist.whitelist));
      assert.equal(propertyWithWhitelist.whitelist.length, 2);
      assert.equal(propertyWithWhitelist.whitelist[0], 'domain1.com');
      assert.equal(propertyWithWhitelist.whitelist[1], 'domain2.com');
    });

    it('should generate slug for each property', async () => {
      const csvPath = path.join(TEST_DATA_DIR, 'valid.csv');
      const properties = await loadPropertiesFromCSV(csvPath);

      assert.ok(properties[0].slug);
      assert.equal(typeof properties[0].slug, 'string');
      assert.match(properties[0].slug, /^[a-z0-9-]+$/);
    });
  });

  describe('findPropertyByMeasurementId()', () => {
    it('should find property by measurement ID', async () => {
      const csvPath = path.join(TEST_DATA_DIR, 'valid.csv');
      const properties = await loadPropertiesFromCSV(csvPath);

      const found = findPropertyByMeasurementId(properties, 'G-DEF9876543');
      assert.ok(found);
      assert.equal(found.propertyName, 'INNISFREE');
    });

    it('should return null for non-existent measurement ID', async () => {
      const csvPath = path.join(TEST_DATA_DIR, 'valid.csv');
      const properties = await loadPropertiesFromCSV(csvPath);

      const found = findPropertyByMeasurementId(properties, 'G-NONEXIST');
      assert.equal(found, null);
    });
  });

  describe('filterPropertiesByAccount()', () => {
    it('should filter properties by account name', async () => {
      const csvPath = path.join(TEST_DATA_DIR, 'valid.csv');
      const properties = await loadPropertiesFromCSV(csvPath);

      const filtered = filterPropertiesByAccount(properties, '아모레퍼시픽');
      assert.equal(filtered.length, 3);
    });

    it('should return empty array for non-existent account', async () => {
      const csvPath = path.join(TEST_DATA_DIR, 'valid.csv');
      const properties = await loadPropertiesFromCSV(csvPath);

      const filtered = filterPropertiesByAccount(properties, 'NonExistent');
      assert.equal(filtered.length, 0);
    });
  });

  describe('validateCSVFile()', () => {
    it('should return true for existing readable file', async () => {
      const csvPath = path.join(TEST_DATA_DIR, 'valid.csv');
      const isValid = await validateCSVFile(csvPath);

      assert.equal(isValid, true);
    });

    it('should return false for non-existent file', async () => {
      const csvPath = path.join(TEST_DATA_DIR, 'nonexistent.csv');
      const isValid = await validateCSVFile(csvPath);

      assert.equal(isValid, false);
    });
  });

  /**
   * Story 1.2: Property Metadata Extraction Tests
   */
  describe('Story 1.2: Metadata Extraction', () => {
    describe('Property data model (AC1, AC2, AC3, AC4)', () => {
      it('should extract measurement ID from CSV', async () => {
        const csvPath = path.join(TEST_DATA_DIR, 'valid.csv');
        const properties = await loadPropertiesFromCSV(csvPath);

        assert.ok(properties.length > 0);
        assert.ok(properties[0].measurementId);
        assert.match(properties[0].measurementId, /^G-[A-Z0-9]{10}$/);
      });

      it('should extract GTM container ID from CSV', async () => {
        const csvPath = path.join(TEST_DATA_DIR, 'valid.csv');
        const properties = await loadPropertiesFromCSV(csvPath);

        assert.ok(properties[0].webGtmId);
        assert.match(properties[0].webGtmId, /^GTM-[A-Z0-9]+$/);
      });

      it('should extract representative URL from CSV', async () => {
        const csvPath = path.join(TEST_DATA_DIR, 'valid.csv');
        const properties = await loadPropertiesFromCSV(csvPath);

        assert.ok(properties[0].representativeUrl);
        assert.match(properties[0].representativeUrl, /^https?:\/\/.+/);
      });

      it('should extract whitelist domains as array', async () => {
        const csvPath = path.join(TEST_DATA_DIR, 'valid.csv');
        const properties = await loadPropertiesFromCSV(csvPath);

        const propertyWithWhitelist = properties.find(p => p.whitelist);
        assert.ok(propertyWithWhitelist);
        assert.ok(Array.isArray(propertyWithWhitelist.whitelist));
        assert.ok(propertyWithWhitelist.whitelist.length > 0);
      });
    });

    describe('Field validation (AC5)', () => {
      it('should skip rows with missing measurement ID', async () => {
        const CSV_MISSING_MEASUREMENT_ID = `계정명,속성명,WebStream Measurement ID,사이트 유형,대표 URLs,웹/앱 여부,Web GTM Pubilic ID
아모레퍼시픽,Valid Property,G-ABC1234567,EC,https://valid.com,웹,GTM-XXXXXX
아모레퍼시픽,Invalid Property,-,EC,https://invalid.com,웹,GTM-YYYYYY`;

        await fs.writeFile(
          path.join(TEST_DATA_DIR, 'missing-measurement-id.csv'),
          CSV_MISSING_MEASUREMENT_ID,
          'utf-8'
        );

        const csvPath = path.join(TEST_DATA_DIR, 'missing-measurement-id.csv');
        const properties = await loadPropertiesFromCSV(csvPath);

        // Should only load the valid property
        assert.equal(properties.length, 1);
        assert.equal(properties[0].propertyName, 'Valid Property');
      });

      it('should skip rows with missing representative URL', async () => {
        const CSV_MISSING_URL = `계정명,속성명,WebStream Measurement ID,사이트 유형,대표 URLs,웹/앱 여부,Web GTM Pubilic ID
아모레퍼시픽,Valid Property,G-ABC1234567,EC,https://valid.com,웹,GTM-XXXXXX
아모레퍼시픽,Invalid Property,G-DEF9876543,EC,-,웹,GTM-YYYYYY`;

        await fs.writeFile(
          path.join(TEST_DATA_DIR, 'missing-url.csv'),
          CSV_MISSING_URL,
          'utf-8'
        );

        const csvPath = path.join(TEST_DATA_DIR, 'missing-url.csv');
        const properties = await loadPropertiesFromCSV(csvPath);

        // Should only load the valid property
        assert.equal(properties.length, 1);
        assert.equal(properties[0].propertyName, 'Valid Property');
      });

      it('should skip rows with invalid measurement ID format', async () => {
        const CSV_INVALID_FORMAT = `계정명,속성명,WebStream Measurement ID,사이트 유형,대표 URLs,웹/앱 여부,Web GTM Pubilic ID
아모레퍼시픽,Valid Property,G-ABC1234567,EC,https://valid.com,웹,GTM-XXXXXX
아모레퍼시픽,Invalid Format,INVALID-ID,EC,https://invalid.com,웹,GTM-YYYYYY`;

        await fs.writeFile(
          path.join(TEST_DATA_DIR, 'invalid-measurement-format.csv'),
          CSV_INVALID_FORMAT,
          'utf-8'
        );

        const csvPath = path.join(TEST_DATA_DIR, 'invalid-measurement-format.csv');
        const properties = await loadPropertiesFromCSV(csvPath);

        // Should only load the valid property
        assert.equal(properties.length, 1);
        assert.equal(properties[0].measurementId, 'G-ABC1234567');
      });

      it('should skip invalid GTM ID but load property', async () => {
        const CSV_INVALID_GTM = `계정명,속성명,WebStream Measurement ID,사이트 유형,대표 URLs,웹/앱 여부,Web GTM Pubilic ID
아모레퍼시픽,Valid GTM,G-ABC1234567,EC,https://valid.com,웹,GTM-XXXXXX
아모레퍼시픽,Invalid GTM,G-DEF9876543,EC,https://test.com,웹,INVALID-GTM`;

        await fs.writeFile(
          path.join(TEST_DATA_DIR, 'invalid-gtm.csv'),
          CSV_INVALID_GTM,
          'utf-8'
        );

        const csvPath = path.join(TEST_DATA_DIR, 'invalid-gtm.csv');
        const properties = await loadPropertiesFromCSV(csvPath);

        // Should load both properties
        assert.equal(properties.length, 2);

        // First property should have GTM ID
        assert.equal(properties[0].webGtmId, 'GTM-XXXXXX');

        // Second property should NOT have GTM ID (invalid format)
        assert.equal(properties[1].webGtmId, undefined);
      });

      it('should skip rows with invalid URL format', async () => {
        const CSV_INVALID_URL = `계정명,속성명,WebStream Measurement ID,사이트 유형,대표 URLs,웹/앱 여부,Web GTM Pubilic ID
아모레퍼시픽,Valid URL,G-ABC1234567,EC,https://valid.com,웹,GTM-XXXXXX
아모레퍼시픽,Invalid URL,G-DEF9876543,EC,not-a-url,웹,GTM-YYYYYY`;

        await fs.writeFile(
          path.join(TEST_DATA_DIR, 'invalid-url.csv'),
          CSV_INVALID_URL,
          'utf-8'
        );

        const csvPath = path.join(TEST_DATA_DIR, 'invalid-url.csv');
        const properties = await loadPropertiesFromCSV(csvPath);

        // Should only load the valid property
        assert.equal(properties.length, 1);
        assert.equal(properties[0].representativeUrl, 'https://valid.com');
      });
    });
  });
});

describe('Story 1.3: CSV Update Detection', () => {
  const CACHE_PATH = path.join(TEST_DATA_DIR, 'test-cache.json');

  beforeEach(async () => {
    // Clean up test cache before each test
    try {
      await fs.unlink(CACHE_PATH);
    } catch (error) {
      // Ignore if file doesn't exist
    }
  });

  afterEach(async () => {
    // Clean up test cache after each test
    try {
      await fs.unlink(CACHE_PATH);
    } catch (error) {
      // Ignore if file doesn't exist
    }
  });

  describe('detectPropertyChanges() (AC2, AC3)', () => {
    it('should detect added properties', () => {
      const oldProperties = [
        { measurementId: 'G-OLD1234567', propertyName: 'Old Property 1' },
        { measurementId: 'G-OLD2345678', propertyName: 'Old Property 2' }
      ];

      const newProperties = [
        { measurementId: 'G-OLD1234567', propertyName: 'Old Property 1' },
        { measurementId: 'G-OLD2345678', propertyName: 'Old Property 2' },
        { measurementId: 'G-NEW3456789', propertyName: 'New Property 3' }
      ];

      const changes = detectPropertyChanges(oldProperties, newProperties);

      assert.equal(changes.added.length, 1);
      assert.equal(changes.added[0].measurementId, 'G-NEW3456789');
      assert.equal(changes.removed.length, 0);
    });

    it('should detect removed properties', () => {
      const oldProperties = [
        { measurementId: 'G-OLD1234567', propertyName: 'Old Property 1' },
        { measurementId: 'G-OLD2345678', propertyName: 'Old Property 2' },
        { measurementId: 'G-OLD3456789', propertyName: 'Old Property 3' }
      ];

      const newProperties = [
        { measurementId: 'G-OLD1234567', propertyName: 'Old Property 1' },
        { measurementId: 'G-OLD2345678', propertyName: 'Old Property 2' }
      ];

      const changes = detectPropertyChanges(oldProperties, newProperties);

      assert.equal(changes.added.length, 0);
      assert.equal(changes.removed.length, 1);
      assert.equal(changes.removed[0].measurementId, 'G-OLD3456789');
    });

    it('should detect both added and removed properties', () => {
      const oldProperties = [
        { measurementId: 'G-OLD1234567', propertyName: 'Old Property 1' },
        { measurementId: 'G-REM2345678', propertyName: 'Removed Property' }
      ];

      const newProperties = [
        { measurementId: 'G-OLD1234567', propertyName: 'Old Property 1' },
        { measurementId: 'G-NEW3456789', propertyName: 'New Property' }
      ];

      const changes = detectPropertyChanges(oldProperties, newProperties);

      assert.equal(changes.added.length, 1);
      assert.equal(changes.added[0].measurementId, 'G-NEW3456789');
      assert.equal(changes.removed.length, 1);
      assert.equal(changes.removed[0].measurementId, 'G-REM2345678');
    });

    it('should detect no changes when properties are identical', () => {
      const oldProperties = [
        { measurementId: 'G-ABC1234567', propertyName: 'Property 1' },
        { measurementId: 'G-ABC2345678', propertyName: 'Property 2' }
      ];

      const newProperties = [
        { measurementId: 'G-ABC1234567', propertyName: 'Property 1' },
        { measurementId: 'G-ABC2345678', propertyName: 'Property 2' }
      ];

      const changes = detectPropertyChanges(oldProperties, newProperties);

      assert.equal(changes.added.length, 0);
      assert.equal(changes.removed.length, 0);
    });

    it('should handle empty old properties (first run)', () => {
      const oldProperties = [];
      const newProperties = [
        { measurementId: 'G-NEW1234567', propertyName: 'New Property 1' },
        { measurementId: 'G-NEW2345678', propertyName: 'New Property 2' }
      ];

      const changes = detectPropertyChanges(oldProperties, newProperties);

      assert.equal(changes.added.length, 2);
      assert.equal(changes.removed.length, 0);
    });

    it('should handle empty new properties', () => {
      const oldProperties = [
        { measurementId: 'G-OLD1234567', propertyName: 'Old Property 1' }
      ];
      const newProperties = [];

      const changes = detectPropertyChanges(oldProperties, newProperties);

      assert.equal(changes.added.length, 0);
      assert.equal(changes.removed.length, 1);
    });
  });

  describe('Property persistence (AC1, AC4)', () => {
    it('should save and load properties from cache', async () => {
      const properties = [
        { measurementId: 'G-TEST1234567', propertyName: 'Test Property 1' },
        { measurementId: 'G-TEST2345678', propertyName: 'Test Property 2' }
      ];

      // Save properties
      await savePreviousProperties(properties, CACHE_PATH);

      // Load properties
      const loaded = await loadPreviousProperties(CACHE_PATH);

      assert.equal(loaded.length, 2);
      assert.equal(loaded[0].measurementId, 'G-TEST1234567');
      assert.equal(loaded[1].measurementId, 'G-TEST2345678');
    });

    it('should return empty array when cache file does not exist', async () => {
      const nonExistentPath = path.join(TEST_DATA_DIR, 'non-existent-cache.json');

      const loaded = await loadPreviousProperties(nonExistentPath);

      assert.ok(Array.isArray(loaded));
      assert.equal(loaded.length, 0);
    });

    it('should return empty array when cache file has invalid JSON', async () => {
      // Create invalid JSON file
      await fs.writeFile(CACHE_PATH, 'invalid json content', 'utf-8');

      const loaded = await loadPreviousProperties(CACHE_PATH);

      assert.ok(Array.isArray(loaded));
      assert.equal(loaded.length, 0);
    });

    it('should create cache directory if it does not exist', async () => {
      const nestedCachePath = path.join(TEST_DATA_DIR, 'nested', 'deep', 'cache.json');
      const properties = [
        { measurementId: 'G-TEST1234567', propertyName: 'Test Property' }
      ];

      // Save properties to nested path
      await savePreviousProperties(properties, nestedCachePath);

      // Verify file was created
      const loaded = await loadPreviousProperties(nestedCachePath);
      assert.equal(loaded.length, 1);

      // Cleanup nested directories
      await fs.rm(path.join(TEST_DATA_DIR, 'nested'), { recursive: true, force: true });
    });
  });
});
