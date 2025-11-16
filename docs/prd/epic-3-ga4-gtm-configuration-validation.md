# Epic 3: GA4/GTM Configuration Validation

## Overview

**목표**: Chrome DevTools Protocol 기반 GA4/GTM 설정 검증 시스템 구축

**설명**:
Chrome DevTools Protocol(CDP)을 사용하여 네트워크 요청을 감청하고, `analytics.google.com/g/collect` 패턴의 GA4 이벤트를 캡처합니다. 측정 ID, GTM 컨테이너 ID, page_view 이벤트 발생 여부를 CSV 파일의 기대값과 비교 검증하며, Amorepacific 특화 설정(AP_DATA)도 추출하여 검증합니다.

**연관 Requirements**: FR5, FR6, FR7, FR8, FR9, NFR3, NFR4

**우선순위**: P0 (MVP 필수 기능)

**이유**: GA4/GTM 설정 검증은 시스템의 핵심 비즈니스 가치이며, 데이터 손실 방지라는 주요 목표를 달성하는 핵심 기능입니다.

---

## User Stories

### User Story 3.1: CDP 네트워크 이벤트 캡처

**Story**: As a 시스템 개발자, I want Chrome DevTools Protocol을 사용하여 네트워크 요청을 감청하기를 원합니다, so that GA4 이벤트를 캡처하여 검증할 수 있습니다.

**Acceptance Criteria**:
- [ ] CDP를 활성화하여 네트워크 이벤트를 감청한다
- [ ] `analytics.google.com/g/collect` 패턴의 요청을 필터링한다
- [ ] 캡처된 요청의 URL 파라미터를 파싱하여 측정 ID와 이벤트 정보를 추출한다
- [ ] 페이지 로드 후 최대 10초간 네트워크 이벤트를 대기한다
- [ ] 캡처된 모든 GA4 이벤트를 배열로 저장한다

**Technical Notes**:
- 모듈: `networkEventCapturer`
- CDP Domain: Network
- 필터 패턴: `https://analytics.google.com/g/collect*`
- 대기 시간: 환경변수 `NETWORK_TIMEOUT_MS` (기본값 10000ms)

**CDP Setup**:
```javascript
async function startCapturing(page) {
  const client = await page.context().newCDPSession(page);
  await client.send('Network.enable');

  const capturedEvents = [];

  client.on('Network.requestWillBeSent', (params) => {
    if (params.request.url.includes('analytics.google.com/g/collect')) {
      capturedEvents.push({
        url: params.request.url,
        method: params.request.method,
        headers: params.request.headers,
        timestamp: params.timestamp
      });
    }
  });

  return capturedEvents;
}
```

**URL Parameter Parsing**:
```javascript
function parseGA4Params(url) {
  const urlObj = new URL(url);
  const params = {};

  // Extract measurement ID (tid parameter)
  params.measurementId = urlObj.searchParams.get('tid'); // G-XXXXXXXXX

  // Extract event name (en parameter)
  params.eventName = urlObj.searchParams.get('en'); // e.g., 'page_view'

  // Extract other GA4 parameters
  params.clientId = urlObj.searchParams.get('cid');
  params.sessionId = urlObj.searchParams.get('sid');

  return params;
}
```

---

### User Story 3.2: 측정 ID 검증

**Story**: As a 디지털 애널리틱스 팀원, I want 캡처된 GA4 이벤트의 측정 ID를 CSV 기대값과 비교하기를 원합니다, so that 올바른 GA4 속성으로 데이터가 전송되는지 확인할 수 있습니다.

**Acceptance Criteria**:
- [ ] 캡처된 GA4 이벤트에서 측정 ID(G-XXXXXXXXX)를 추출한다
- [ ] CSV 파일의 기대 측정 ID와 일치 여부를 확인한다
- [ ] 측정 ID 불일치 시 이슈로 기록한다
- [ ] 측정 ID가 전혀 감지되지 않으면 "측정 ID 없음" 이슈로 기록한다
- [ ] 검증 결과(일치/불일치)를 JSON 결과에 저장한다

**Technical Notes**:
- 모듈: `configValidator`
- 함수: `validateMeasurementId(capturedEvents, expectedMeasurementId)`
- 정규식: `G-[A-Z0-9]{10}`

**Validation Logic**:
```javascript
function validateMeasurementId(capturedEvents, expectedMeasurementId) {
  const issues = [];

  // Extract measurement IDs from captured events
  const actualMeasurementIds = capturedEvents
    .map(event => parseGA4Params(event.url).measurementId)
    .filter(id => id); // Remove null/undefined

  if (actualMeasurementIds.length === 0) {
    issues.push({
      type: 'MEASUREMENT_ID_NOT_FOUND',
      severity: 'critical',
      message: 'No GA4 measurement ID detected',
      expected: expectedMeasurementId,
      actual: null,
      timestamp: new Date().toISOString()
    });
    return { isValid: false, actualId: null, issues };
  }

  // Check if expected measurement ID is present
  const actualId = actualMeasurementIds[0];
  if (actualId !== expectedMeasurementId) {
    issues.push({
      type: 'MEASUREMENT_ID_MISMATCH',
      severity: 'critical',
      message: `Measurement ID mismatch`,
      expected: expectedMeasurementId,
      actual: actualId,
      timestamp: new Date().toISOString()
    });
    return { isValid: false, actualId, issues };
  }

  return { isValid: true, actualId, issues: [] };
}
```

---

### User Story 3.3: GTM 컨테이너 ID 검증

**Story**: As a 디지털 애널리틱스 팀원, I want 페이지의 GTM 스크립트에서 컨테이너 ID를 추출하여 CSV 기대값과 비교하기를 원합니다, so that 올바른 GTM 컨테이너가 로드되는지 확인할 수 있습니다.

**Acceptance Criteria**:
- [ ] 페이지 HTML에서 GTM 스크립트 태그를 검색한다
- [ ] GTM 컨테이너 ID(GTM-XXXXXXXX)를 정규식으로 추출한다
- [ ] CSV 파일의 기대 GTM ID와 일치 여부를 확인한다
- [ ] GTM ID 불일치 시 이슈로 기록한다
- [ ] GTM 스크립트가 전혀 없으면 "GTM 없음" 이슈로 기록한다
- [ ] 검증 결과(일치/불일치)를 JSON 결과에 저장한다

**Technical Notes**:
- 모듈: `configValidator`
- 함수: `validateGTMId(page, expectedGtmId)`
- 정규식: `GTM-[A-Z0-9]{6,}`

**GTM Detection Logic**:
```javascript
async function validateGTMId(page, expectedGtmId) {
  const issues = [];

  // Get page HTML content
  const htmlContent = await page.content();

  // Search for GTM script tags
  const gtmPattern = /GTM-[A-Z0-9]{6,}/g;
  const matches = htmlContent.match(gtmPattern);

  if (!matches || matches.length === 0) {
    issues.push({
      type: 'GTM_NOT_FOUND',
      severity: 'critical',
      message: 'No GTM script detected on page',
      expected: expectedGtmId,
      actual: null,
      timestamp: new Date().toISOString()
    });
    return { isValid: false, actualId: null, issues };
  }

  // Check if expected GTM ID is present
  const actualId = matches[0];
  if (actualId !== expectedGtmId) {
    issues.push({
      type: 'GTM_ID_MISMATCH',
      severity: 'critical',
      message: `GTM container ID mismatch`,
      expected: expectedGtmId,
      actual: actualId,
      timestamp: new Date().toISOString()
    });
    return { isValid: false, actualId, issues };
  }

  return { isValid: true, actualId, issues: [] };
}
```

---

### User Story 3.4: page_view 이벤트 검증

**Story**: As a 디지털 애널리틱스 팀원, I want page_view 이벤트가 정상적으로 발생하는지 확인하기를 원합니다, so that 기본 페이지뷰 추적이 동작하는지 검증할 수 있습니다.

**Acceptance Criteria**:
- [ ] 캡처된 GA4 이벤트 중 `page_view` 이벤트를 검색한다
- [ ] `page_view` 이벤트가 최소 1회 발생했는지 확인한다
- [ ] `page_view` 이벤트 미발생 시 이슈로 기록한다
- [ ] 검증 결과(발생/미발생)를 JSON 결과에 저장한다

**Technical Notes**:
- 모듈: `configValidator`
- 함수: `validatePageViewEvent(capturedEvents)`
- 이벤트명 파라미터: `en=page_view`

**Validation Logic**:
```javascript
function validatePageViewEvent(capturedEvents) {
  const issues = [];

  // Search for page_view events
  const pageViewEvents = capturedEvents.filter(event => {
    const params = parseGA4Params(event.url);
    return params.eventName === 'page_view';
  });

  const count = pageViewEvents.length;

  if (count === 0) {
    issues.push({
      type: 'PAGE_VIEW_NOT_FOUND',
      severity: 'critical',
      message: 'No page_view event detected',
      expected: 'page_view event',
      actual: `0 events found`,
      timestamp: new Date().toISOString()
    });
    return { isValid: false, count: 0, issues };
  }

  return { isValid: true, count, issues: [] };
}
```

---

### User Story 3.5: AP_DATA 환경변수 검증

**Story**: As a 디지털 애널리틱스 팀원, I want 페이지의 AP_DATA 환경변수를 추출하여 검증하기를 원합니다, so that Amorepacific 특화 설정이 올바른지 확인할 수 있습니다.

**Acceptance Criteria**:
- [ ] 페이지의 전역 변수 `window.AP_DATA`를 검색한다
- [ ] Data layer에서 `AP_DATA` 객체를 검색한다
- [ ] `AP_DATA`가 존재하면 내용을 JSON 결과에 저장한다
- [ ] `AP_DATA`가 없으면 경고 로그를 출력하지만 이슈로 기록하지는 않는다
- [ ] `AP_DATA` 추출 실패 시에도 다른 검증은 계속 진행한다

**Technical Notes**:
- 모듈: `configValidator`
- 함수: `extractAPData(page)`
- 비필수 검증 (optional): 실패해도 다른 검증 계속 진행

**AP_DATA Extraction**:
```javascript
async function extractAPData(page) {
  try {
    // Try to extract from window.AP_DATA
    const apData = await page.evaluate(() => {
      return window.AP_DATA || null;
    });

    if (apData) {
      return apData;
    }

    // Try to extract from data layer
    const dataLayerAP = await page.evaluate(() => {
      if (window.dataLayer && Array.isArray(window.dataLayer)) {
        for (const item of window.dataLayer) {
          if (item.AP_DATA) {
            return item.AP_DATA;
          }
        }
      }
      return null;
    });

    if (dataLayerAP) {
      return dataLayerAP;
    }

    // AP_DATA not found - log warning but don't fail
    console.warn('AP_DATA not found on page');
    return null;

  } catch (error) {
    console.error('Failed to extract AP_DATA:', error);
    return null;
  }
}
```

---

## Implementation Plan

### Phase 1: CDP 네트워크 감청
1. `networkEventCapturer/startCapturing()` 함수 구현
2. CDP Network.enable 활성화
3. Network.requestWillBeSent 이벤트 리스너 등록
4. analytics.google.com 필터링
5. 캡처된 이벤트 배열 반환

### Phase 2: 파라미터 파싱
1. `parseGA4Params()` 함수 구현
2. URL 파싱 (URLSearchParams 사용)
3. 측정 ID (tid), 이벤트명 (en) 추출
4. NetworkEvent 객체 생성

### Phase 3: 측정 ID & GTM 검증
1. `configValidator/validateMeasurementId()` 함수 구현
2. `configValidator/validateGTMId()` 함수 구현
3. 정규식 패턴 정의 (G-[A-Z0-9]{10}, GTM-[A-Z0-9]{6,})
4. 기대값 vs 실제값 비교
5. IssueReport 객체 생성

### Phase 4: page_view & AP_DATA
1. `validatePageViewEvent()` 함수 구현
2. `extractAPData()` 함수 구현
3. page.evaluate()로 전역 변수 접근
4. Data layer 검색

### Phase 5: 통합 검증
1. `configValidator/validateProperty()` 함수 구현
2. 모든 검증 함수 호출
3. 이슈 집계
4. ValidationResult 객체 생성

---

## Testing

### Unit Tests
```javascript
describe('networkEventCapturer', () => {
  it('should capture GA4 events', async () => {
    const page = await browser.newPage();
    await startCapturing(page);
    await page.goto('https://www.amoremall.com');

    const events = await waitForGA4Events(page, 10000);
    expect(events.length).toBeGreaterThan(0);
  });

  it('should parse measurement ID from URL', () => {
    const url = 'https://analytics.google.com/g/collect?tid=G-ABC1234567&en=page_view';
    const params = parseGA4Params(url);
    expect(params.measurementId).toBe('G-ABC1234567');
    expect(params.eventName).toBe('page_view');
  });
});

describe('configValidator', () => {
  it('should validate matching measurement ID', () => {
    const capturedEvents = [
      { url: 'https://analytics.google.com/g/collect?tid=G-ABC1234567&en=page_view' }
    ];
    const result = validateMeasurementId(capturedEvents, 'G-ABC1234567');
    expect(result.isValid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('should detect measurement ID mismatch', () => {
    const capturedEvents = [
      { url: 'https://analytics.google.com/g/collect?tid=G-XYZ9876543&en=page_view' }
    ];
    const result = validateMeasurementId(capturedEvents, 'G-ABC1234567');
    expect(result.isValid).toBe(false);
    expect(result.issues[0].type).toBe('MEASUREMENT_ID_MISMATCH');
  });

  it('should detect missing GTM script', async () => {
    const page = await browser.newPage();
    await page.setContent('<html><body>No GTM here</body></html>');

    const result = await validateGTMId(page, 'GTM-XXXXXXXX');
    expect(result.isValid).toBe(false);
    expect(result.issues[0].type).toBe('GTM_NOT_FOUND');
  });

  it('should validate page_view event', () => {
    const capturedEvents = [
      { url: 'https://analytics.google.com/g/collect?tid=G-ABC1234567&en=page_view' }
    ];
    const result = validatePageViewEvent(capturedEvents);
    expect(result.isValid).toBe(true);
    expect(result.count).toBe(1);
  });

  it('should extract AP_DATA from page', async () => {
    const page = await browser.newPage();
    await page.setContent(`
      <html>
        <script>
          window.AP_DATA = { brand: 'AMOREMALL', country: 'KR' };
        </script>
        <body>Test</body>
      </html>
    `);

    const apData = await extractAPData(page);
    expect(apData).toEqual({ brand: 'AMOREMALL', country: 'KR' });
  });
});
```

### E2E Tests
```javascript
describe('GA4/GTM Validation E2E', () => {
  it('should validate real property with correct configuration', async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    // Start capturing
    await startCapturing(page);

    // Navigate to property
    await page.goto('https://www.amoremall.com');

    // Wait for GA4 events
    const events = await waitForGA4Events(page, 10000);

    // Validate
    const property = {
      measurementId: 'G-ABC1234567',
      webGtmId: 'GTM-XXXXXXXX'
    };

    const result = await validateProperty(page, events, property);

    expect(result.measurementId.isValid).toBe(true);
    expect(result.gtmId.isValid).toBe(true);
    expect(result.pageViewEvent.isValid).toBe(true);
    expect(result.issues).toHaveLength(0);

    await browser.close();
  });
});
```

---

## Dependencies

### Modules
- `networkEventCapturer`: CDP 네트워크 감청
- `configValidator`: 설정 검증 로직

### External Libraries
- `playwright`: ^1.40.0 - CDP 접근

### Related Architecture
- Data Model: `NetworkEvent`, `ValidationResult`, `IssueReport` (architecture.md 참조)
- API: `networkEventCapturer`, `configValidator` 모듈 (architecture.md 참조)

---

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| GA4 스크립트 변경 (Google 업데이트) | High | 정기적인 검증 로직 업데이트, 유연한 파라미터 파싱 |
| 네트워크 타임아웃 (10초 내 이벤트 미발생) | Medium | 재시도 로직, 타임아웃 시간 조정 가능 |
| 비표준 GTM 구현 | Low | 정규식 패턴 확장, 개별 속성 커스텀 검증 |
| AP_DATA 누락 | Low | 비필수 검증, 경고 로그만 출력 |

---

## Success Metrics

- [ ] GA4 이벤트 캡처율 > 95% (10초 내)
- [ ] 측정 ID 검증 정확도 > 99%
- [ ] GTM ID 검증 정확도 > 99%
- [ ] page_view 이벤트 검출률 > 95%
- [ ] False positive rate < 5%
- [ ] False negative rate < 5%

---

**Epic Status**: ✅ Completed
**Assigned To**: James (Dev Agent)
**Completion Date**: 2025-10-30
**Target Sprint**: Sprint 1-2 (Week 2-3)
**Stories Completed**: 5/5 (3.1, 3.2, 3.3, 3.4, 3.5 - All Done)
**QA Status**: Stories 3.2 (QA gate PASS 95/100), 3.3 (QA gate PASS) with comprehensive test coverage
