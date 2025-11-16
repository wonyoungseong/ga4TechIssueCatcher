/**
 * Test Consent Mode Basic detection functionality
 * Story 11.2: Consent Mode Basic Handling Enhancement
 */

import { detectConsentModeBasic } from './src/modules/networkEventCapturer.js';
import { validateMeasurementId, ISSUE_TYPE, SEVERITY } from './src/modules/configValidator.js';

console.log('🧪 Testing Consent Mode Basic Detection\n');

// Test 1: Consent Mode Basic scenario
console.log('Test 1: GTM present, GA4 not in window, no network events');
{
  const context = {
    hasGTM: true,
    hasGA4InWindow: false,
    networkEvents: [],
    expectedGA4Id: 'G-67KP9F9311'
  };

  const result = detectConsentModeBasic(context);
  console.log('Result:', result);
  console.assert(result.isConsentModeBasic === true, 'Should detect Consent Mode Basic');
  console.assert(result.confidence === 'high', 'Should have high confidence');
  console.assert(result.ga4Configured === true, 'Should indicate GA4 is configured');
  console.log('✅ Test 1 passed\n');
}

// Test 2: Normal GA4 implementation
console.log('Test 2: GTM present, GA4 in window (normal implementation)');
{
  const context = {
    hasGTM: true,
    hasGA4InWindow: true,
    networkEvents: [],
    expectedGA4Id: 'G-67KP9F9311'
  };

  const result = detectConsentModeBasic(context);
  console.log('Result:', result);
  console.assert(result.isConsentModeBasic === false, 'Should not detect Consent Mode Basic');
  console.assert(result.message === 'Normal GA4 implementation detected', 'Should indicate normal implementation');
  console.log('✅ Test 2 passed\n');
}

// Test 3: Consent Mode Advanced (some network activity)
console.log('Test 3: GTM present, GA4 not in window, but some network activity');
{
  const context = {
    hasGTM: true,
    hasGA4InWindow: false,
    networkEvents: [
      {
        type: 'ga4_collect',
        params: { tid: 'G-67KP9F9311', en: 'consent' }
      }
    ],
    expectedGA4Id: 'G-67KP9F9311'
  };

  const result = detectConsentModeBasic(context);
  console.log('Result:', result);
  console.assert(result.isConsentModeBasic === false, 'Should not detect as Basic mode');
  console.assert(result.confidence === 'medium', 'Should have medium confidence');
  console.assert(result.message.includes('Advanced'), 'Should mention Advanced mode');
  console.log('✅ Test 3 passed\n');
}

// Test 4: No GTM scenario
console.log('Test 4: No GTM detected');
{
  const context = {
    hasGTM: false,
    hasGA4InWindow: false,
    networkEvents: [],
    expectedGA4Id: 'G-67KP9F9311'
  };

  const result = detectConsentModeBasic(context);
  console.log('Result:', result);
  console.assert(result.isConsentModeBasic === false, 'Should not detect Consent Mode Basic');
  console.assert(result.message === 'No GTM container found', 'Should indicate no GTM');
  console.log('✅ Test 4 passed\n');
}

// Test 5: Integration with validateMeasurementId
console.log('Test 5: Integration with validateMeasurementId function');
{
  const property = {
    measurementId: 'G-67KP9F9311',
    propertyName: 'AESTURA',
    hasConsentMode: false
  };

  const events = []; // No network events

  const context = {
    hasGTM: true,
    hasGA4InWindow: false
  };

  const validationResult = validateMeasurementId(property, events, context);
  console.log('Validation result:', validationResult);

  console.assert(validationResult.isValid === true, 'Should be valid (GA4 configured but blocked)');
  console.assert(validationResult.issues.length === 1, 'Should have one issue');
  console.assert(validationResult.issues[0].type === ISSUE_TYPE.CONSENT_MODE_BASIC_DETECTED, 'Should be Consent Mode Basic issue');
  console.assert(validationResult.issues[0].severity === SEVERITY.INFO, 'Should be INFO severity');
  console.assert(validationResult.extractionSource.consentMode !== undefined, 'Should have consentMode in extraction source');
  console.assert(validationResult.extractionSource.consentMode.type === 'basic', 'Should indicate basic mode');
  console.log('✅ Test 5 passed\n');
}

// Test 6: validateMeasurementId without context (backward compatibility)
console.log('Test 6: Backward compatibility - validateMeasurementId without context');
{
  const property = {
    measurementId: 'G-12345678',
    propertyName: 'Test Property',
    hasConsentMode: false
  };

  const events = []; // No network events

  // Call without context parameter
  const validationResult = validateMeasurementId(property, events);
  console.log('Validation result:', validationResult);

  console.assert(validationResult.isValid === false, 'Should be invalid (no GA4 detected)');
  console.assert(validationResult.issues[0].type === ISSUE_TYPE.NO_GA4_EVENTS, 'Should be NO_GA4_EVENTS issue');
  console.assert(validationResult.issues[0].severity === SEVERITY.CRITICAL, 'Should be CRITICAL severity');
  console.log('✅ Test 6 passed\n');
}

console.log('=' + '='.repeat(50));
console.log('🎉 All Consent Mode Basic tests passed!');
console.log('=' + '='.repeat(50));