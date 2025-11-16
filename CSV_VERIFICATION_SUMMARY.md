# CSV Verification Summary
**Date**: 2025-10-30
**Purpose**: Verify which CSV mismatches are actual CSV errors vs. timing issues

## Verification Method

Created `verify-single-property.js` script that:
1. Tests each property 3 times in isolation (no resource contention)
2. Uses 20-second wait time (vs 15s in full test)
3. Checks consistency across all 3 tests
4. Provides clear verdict: CSV correct vs incorrect

## Verification Results

### ✅ AYUNCHEPRO-KR - CSV CORRECT (with 2 GA4 IDs)
- **CSV GA4**: `G-LLLJVS3JRX` - ✅ **Found in 3/3 tests**
- **Additional GA4**: `G-DVQWY5N9CV` - Also consistently detected
- **CSV GTM**: `GTM-PFZJG9F3` - ❌ **Wrong** (site uses `GTM-MV2NCX5D`, `GTM-M9BVLGM`)
- **Full test failure reason**: Resource contention prevented `G-LLLJVS3JRX` detection within 15s
- **Action**:
  - ✅ Keep GA4 ID (correct)
  - ❌ Update GTM ID to `GTM-MV2NCX5D` or `GTM-M9BVLGM`

### Remaining Properties to Verify

Run `verify-single-property.js` for each of these properties:

#### 1. EC AYUNCHE-KR
```javascript
const TEST_PROPERTY = {
  propertyName: '[EC] AYUNCHE - KR',
  csvMeasurementId: 'G-P5J15QS8TB',  // CSV value
  url: 'https://www.ayunche.com',
  csvGTMId: 'GTM-PFZJG9F3'
};
```
**Full test result**: Found `G-RK2FDP6TSF` instead

#### 2. EC AMOREPACIFIC-HK
```javascript
const TEST_PROPERTY = {
  propertyName: '[EC] AMOREPACIFIC - HK',
  csvMeasurementId: 'G-EJR4WH09BQ',  // CSV value
  url: 'https://hk.amorepacific.com',
  csvGTMId: 'GTM-5GVP32T'
};
```
**Full test result**: Found `G-KDKYLNNVR9` instead

#### 3. EC INNISFREE-IN (Already verified - timing issue)
```javascript
const TEST_PROPERTY = {
  propertyName: '[EC] INNISFREE - IN',
  csvMeasurementId: 'G-JN5XF0K10E',  // CSV value
  url: 'https://in.innisfree.com',
  csvGTMId: 'GTM-MSKN6NPX'
};
```
**Single test result**: ✅ Found `G-JN5XF0K10E` + `G-QJ31R17988` (542ms)
**Full test result**: ❌ Found only `G-QJ31R17988`
**Verdict**: ✅ **CSV CORRECT** - timing/resource issue

#### 4. EC INNISFREE-MY
```javascript
const TEST_PROPERTY = {
  propertyName: '[EC] INNISFREE - MY',
  csvMeasurementId: 'G-N2GXQ6T4TP',  // CSV value
  url: 'https://my.innisfree.com',
  csvGTMId: 'GTM-TCXCV5M'
};
```
**Full test result**: Found `G-7XM4FBWQ6Q` instead

#### 5. EC INNISFREE-PH
```javascript
const TEST_PROPERTY = {
  propertyName: '[EC] INNISFREE - PH',
  csvMeasurementId: 'G-4M54ZNK74S',  // CSV value
  url: 'https://ph.innisfree.com',
  csvGTMId: 'GTM-TCXCV5M'
};
```
**Full test result**: Found `G-9YKJVZ4J24` instead

#### 6. EC LANEIGE-SG
```javascript
const TEST_PROPERTY = {
  propertyName: '[EC] LANEIGE - SG',
  csvMeasurementId: 'G-VRW0T34CQN',  // CSV value
  url: 'https://sg.laneige.com',
  csvGTMId: 'GTM-545B5CW'
};
```
**Full test result**: Found `G-43N8BP7R8E` instead

## Decision Matrix

| Test Result | Verdict | Action |
|-------------|---------|--------|
| **3/3 tests find CSV ID** | ✅ CSV CORRECT | Keep CSV, fix timeout in crawler |
| **0/3 tests find CSV ID** | ❌ CSV WRONG | Update CSV with detected ID |
| **1-2/3 tests find CSV ID** | ⚠️ INCONSISTENT | Investigate (A/B test? Dynamic?) |

## Recommended Process

1. **For each mismatched property**:
   - Edit `TEST_PROPERTY` in `verify-single-property.js`
   - Run: `node verify-single-property.js`
   - Check verdict

2. **If CSV CORRECT**:
   - Increase `maxWaitAfterPageViewMs` to 25s in `networkEventCapturer.js`
   - Or reduce browser pool to 3 browsers

3. **If CSV WRONG**:
   - Update CSV with the consistently detected ID
   - Document the change

## Summary

**Verified so far**:
- ✅ **INNISFREE-IN**: CSV correct (G-JN5XF0K10E) - timing issue
- ✅ **AYUNCHEPRO-KR**: CSV correct (G-LLLJVS3JRX) + additional ID (G-DVQWY5N9CV) - timing issue
  - ❌ GTM ID wrong - needs update

**Still to verify**: 5 properties (AYUNCHE-KR, AMOREPACIFIC-HK, INNISFREE-MY, INNISFREE-PH, LANEIGE-SG)
