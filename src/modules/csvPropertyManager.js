/**
 * CSV Property Management Module
 *
 * Loads and parses property configuration from CSV file.
 * Provides dynamic property management without code changes.
 *
 * Epic 1: CSV Property Management System
 */

import fs from 'fs/promises';
import { parse } from 'csv-parse/sync';

/**
 * @typedef {Object} Property
 * @property {string} accountName - 계정명
 * @property {string} propertyName - 속성명
 * @property {string} measurementId - GA4 측정 ID (G-XXXXXXXXX)
 * @property {string} siteType - 사이트 유형
 * @property {string} representativeUrl - 대표 URL
 * @property {string} webAppType - 웹/앱 여부
 * @property {string} webGtmId - Web GTM 컨테이너 ID
 * @property {string} [androidGtmId] - Android GTM ID (optional)
 * @property {string} [iosGtmId] - iOS GTM ID (optional)
 * @property {string} [datasetId] - Dataset ID (optional)
 * @property {string} [marketingGtm] - 마케팅 GTM (optional)
 * @property {string[]} [whitelist] - Whitelist 도메인 배열 (optional)
 * @property {string} slug - URL-safe 식별자 (자동 생성)
 */

/**
 * Column name mappings (Korean → English)
 */
const COLUMN_MAPPINGS = {
  '계정명': 'accountName',
  '속성명': 'propertyName',
  'WebStream Measurement ID': 'measurementId',
  '사이트 유형': 'siteType',
  '대표 URLs': 'representativeUrl',
  '웹/앱 여부': 'webAppType',
  'Web GTM Pubilic ID': 'webGtmId',
  'Android GTM Pubilic ID': 'androidGtmId',
  'iOS GTM Pubilic ID': 'iosGtmId',
  'Dataset ID': 'datasetId',
  '마케팅 GTM': 'marketingGtm',
  'whitelist': 'whitelist'
};

/**
 * Validation regex patterns
 */
const VALIDATION_PATTERNS = {
  measurementId: /^G-[A-Z0-9]{10}$/,
  gtmId: /^GTM-[A-Z0-9]{6,}$/,
  url: /^https?:\/\/.+/
};

/**
 * Load properties from CSV file
 *
 * @param {string} csvPath - Path to CSV file
 * @returns {Promise<Array<Property>>} Array of Property objects
 * @throws {Error} If file not found or parsing fails
 */
export async function loadPropertiesFromCSV(csvPath) {
  try {
    // Read CSV file
    const fileContent = await fs.readFile(csvPath, 'utf-8');

    // Parse CSV with csv-parse
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      comment: '#',
      trim: true,
      relax_column_count: true
    });

    // Filter and transform records
    const properties = records
      .filter((record, index) => isValidRecord(record, index + 2)) // +2 for header row and 1-based indexing
      .map(record => transformRecord(record));

    console.log(`✅ Loaded ${properties.length} properties from CSV`);
    return properties;

  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`CSV file not found: ${csvPath}`);
    }
    throw new Error(`Failed to load CSV: ${error.message}`);
  }
}

/**
 * Validate record has required fields
 *
 * @param {Object} record - CSV record
 * @param {number} rowNumber - Row number for logging (optional)
 * @returns {boolean} True if record is valid
 */
function isValidRecord(record, rowNumber = null) {
  const measurementId = record['WebStream Measurement ID'];
  const representativeUrl = record['대표 URLs'];
  const accountName = record['계정명'];
  const propertyName = record['속성명'];
  const rowInfo = rowNumber ? `Row ${rowNumber}` : 'Record';

  // Skip if missing critical fields
  if (!measurementId || measurementId === '-') {
    console.warn(`⚠️  ${rowInfo}: Missing required field 'measurementId' - skipping`);
    return false;
  }

  if (!representativeUrl || representativeUrl === '-') {
    console.warn(`⚠️  ${rowInfo}: Missing required field 'representativeUrl' - skipping`);
    return false;
  }

  // Skip if missing account/property names (likely continuation rows)
  if (!accountName || !propertyName) {
    return false;
  }

  // Skip test properties
  if (propertyName.toLowerCase().includes('test')) {
    return false;
  }

  // Validate measurement ID format
  if (!VALIDATION_PATTERNS.measurementId.test(measurementId)) {
    console.warn(`⚠️  ${rowInfo} (${propertyName}): Invalid measurement ID format '${measurementId}' - skipping`);
    return false;
  }

  // Validate URL format
  if (!VALIDATION_PATTERNS.url.test(representativeUrl)) {
    console.warn(`⚠️  ${rowInfo} (${propertyName}): Invalid URL format '${representativeUrl}' - skipping`);
    return false;
  }

  return true;
}

/**
 * Transform CSV record to Property object
 *
 * @param {Object} record - CSV record
 * @returns {Property} Transformed property object
 */
function transformRecord(record) {
  const property = {};

  // Map columns
  for (const [koreanName, englishName] of Object.entries(COLUMN_MAPPINGS)) {
    const value = record[koreanName];

    if (value && value !== '-') {
      // Handle whitelist as array
      if (englishName === 'whitelist') {
        property[englishName] = value.split(',').map(v => v.trim());
      }
      // Validate GTM IDs if present
      else if (englishName.includes('GtmId')) {
        if (VALIDATION_PATTERNS.gtmId.test(value)) {
          property[englishName] = value;
        } else {
          console.warn(`⚠️  Property '${record['속성명']}': Invalid GTM ID format '${value}' for ${englishName} - skipping field`);
        }
      } else {
        property[englishName] = value;
      }
    }
  }

  // Generate unique slug for file names
  property.slug = generateSlug(property.propertyName);

  return property;
}

/**
 * Generate URL-safe slug from property name
 *
 * @param {string} propertyName - Property display name
 * @returns {string} URL-safe slug
 */
function generateSlug(propertyName) {
  return propertyName
    .toLowerCase()
    .replace(/\[/g, '')
    .replace(/\]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .substring(0, 50);
}

/**
 * Get property by measurement ID
 *
 * @param {Array<Property>} properties - Property array
 * @param {string} measurementId - Measurement ID to find
 * @returns {Property|null} Found property or null
 */
export function findPropertyByMeasurementId(properties, measurementId) {
  return properties.find(p => p.measurementId === measurementId) || null;
}

/**
 * Get properties by account name
 *
 * @param {Array<Property>} properties - Property array
 * @param {string} accountName - Account name to filter
 * @returns {Array<Property>} Filtered properties
 */
export function filterPropertiesByAccount(properties, accountName) {
  return properties.filter(p => p.accountName === accountName);
}

/**
 * Get properties by site type
 *
 * @param {Array<Property>} properties - Property array
 * @param {string} siteType - Site type to filter
 * @returns {Array<Property>} Filtered properties
 */
export function filterPropertiesBySiteType(properties, siteType) {
  return properties.filter(p => p.siteType === siteType);
}

/**
 * Validate CSV file exists and is readable
 *
 * @param {string} csvPath - Path to CSV file
 * @returns {Promise<boolean>} True if file is valid
 */
export async function validateCSVFile(csvPath) {
  try {
    await fs.access(csvPath, fs.constants.R_OK);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * @typedef {Object} PropertyChanges
 * @property {Array<Property>} added - Properties added since last execution
 * @property {Array<Property>} removed - Properties removed since last execution
 */

/**
 * Detect changes between old and new property lists
 *
 * @param {Array<Property>} oldProperties - Previous property list
 * @param {Array<Property>} newProperties - Current property list
 * @returns {PropertyChanges} Changes detected
 */
export function detectPropertyChanges(oldProperties, newProperties) {
  const oldIds = new Set(oldProperties.map(p => p.measurementId));
  const newIds = new Set(newProperties.map(p => p.measurementId));

  const added = newProperties.filter(p => !oldIds.has(p.measurementId));
  const removed = oldProperties.filter(p => !newIds.has(p.measurementId));

  return { added, removed };
}

/**
 * Load previous properties from cache file
 *
 * @param {string} cachePath - Path to cache file
 * @returns {Promise<Array<Property>>} Previous property list or empty array
 */
export async function loadPreviousProperties(cachePath) {
  try {
    const content = await fs.readFile(cachePath, 'utf-8');
    const properties = JSON.parse(content);
    return Array.isArray(properties) ? properties : [];
  } catch (error) {
    // File doesn't exist or invalid JSON - first run or corrupted cache
    return [];
  }
}

/**
 * Save current properties to cache file
 *
 * @param {Array<Property>} properties - Property list to save
 * @param {string} cachePath - Path to cache file
 * @returns {Promise<void>}
 */
export async function savePreviousProperties(properties, cachePath) {
  try {
    // Ensure cache directory exists
    const cacheDir = cachePath.substring(0, cachePath.lastIndexOf('/'));
    await fs.mkdir(cacheDir, { recursive: true });

    // Save properties as JSON
    await fs.writeFile(
      cachePath,
      JSON.stringify(properties, null, 2),
      'utf-8'
    );
  } catch (error) {
    console.warn(`⚠️  Failed to save property cache: ${error.message}`);
  }
}

export default {
  loadPropertiesFromCSV,
  findPropertyByMeasurementId,
  filterPropertiesByAccount,
  filterPropertiesBySiteType,
  validateCSVFile,
  detectPropertyChanges,
  loadPreviousProperties,
  savePreviousProperties
};
