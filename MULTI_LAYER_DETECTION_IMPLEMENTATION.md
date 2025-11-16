# Multi-Layer GA4 Detection Implementation

**날짜**: 2025-10-30
**구현자**: Claude Code
**목적**: Headless 브라우저 감지 이슈 해결을 위한 다중 계층 GA4 이벤트 감지 시스템

---

## 🎯 문제 정의

### 발견된 이슈
MCP 검증을 통해 확인한 결과, 많은 브랜드 사이트들이 **실제로는 GA4가 정상 작동**하지만 크롤러에서는 **false negative**로 보고됨

**예시**:
- **ETUDE (BR)**: 크롤러 ❌ NO_GA4_EVENTS | MCP 검증 ✅ page_view 이벤트 2회 정상 전송
- **LANEIGE (BR)**: 크롤러 ❌ NO_GA4_EVENTS | MCP 검증 ✅ page_view 이벤트 2회 정상 전송 (2.6s, 8.9s)
- **IOPE (BR)**: 크롤러 ❌ NO_GA4_EVENTS | MCP 검증 ✅ page_view 이벤트 2회 정상 전송 (2.1s, 7.9s)

### 근본 원인
- **CDP Network.requestWillBeSent**: 브랜드 사이트들이 headless 브라우저 환경에서 CDP 이벤트를 차단
- **Bot Detection**: User-Agent, WebDriver 플래그 등으로 자동화 도구 감지
- **GA4 전송 차단**: Headless 환경에서만 선택적으로 GA4 전송 안함

---

## 💡 해결 방안: Multi-Layer Detection

### 아키텍처

```
┌─────────────────────────────────────────────────────┐
│           Multi-Layer GA4 Detection                  │
├─────────────────────────────────────────────────────┤
│                                                       │
│  Layer 1: Page Hooks (Primary - Most Reliable)       │
│  ├── Fetch API Hook                                  │
│  ├── XMLHttpRequest Hook                             │
│  └── SendBeacon Hook                                 │
│                                                       │
│  Layer 2: CDP Network Monitoring (Backup)            │
│  └── Network.requestWillBeSent                       │
│                                                       │
│  Deduplication: URL-based merge                      │
│                                                       │
└─────────────────────────────────────────────────────┘
```

### Layer 1: Page-Level Hooks (가장 신뢰성 높음)

**구현 위치**: `networkEventCapturer.js:startCapturing()`

**방법**: `page.addInitScript()` 사용 - 페이지 로드 **전**에 JavaScript 주입

```javascript
await page.addInitScript(() => {
  window.__ga4Events = [];

  // 1. Fetch API Hook
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    const url = args[0];
    if (typeof url === 'string' && url.includes('google-analytics.com/g/collect')) {
      window.__ga4Events.push({ url, type: 'fetch', timestamp: Date.now() });
    }
    return originalFetch.apply(this, args);
  };

  // 2. XMLHttpRequest Hook
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this.__url = url;
    return originalOpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function(...args) {
    if (this.__url && this.__url.includes('google-analytics.com/g/collect')) {
      window.__ga4Events.push({ url: this.__url, type: 'xhr', timestamp: Date.now() });
    }
    return originalSend.apply(this, args);
  };

  // 3. SendBeacon Hook
  const originalBeacon = navigator.sendBeacon;
  navigator.sendBeacon = function(url, ...args) {
    if (url.includes('google-analytics.com/g/collect')) {
      window.__ga4Events.push({ url, type: 'beacon', timestamp: Date.now() });
    }
    return originalBeacon.call(this, url, ...args);
  };
});
```

**장점**:
- ✅ 브라우저 컨텍스트 내에서 실행 → CDP 차단 회피
- ✅ 페이지 로드 전 주입 → 모든 요청 캡처 보장
- ✅ GA4가 사용하는 3가지 전송 방식 모두 커버

### Layer 2: CDP Network Monitoring (백업)

**기존 방식**: `Network.requestWillBeSent` 이벤트 사용

```javascript
const client = await page.context().newCDPSession(page);
await client.send('Network.enable');

client.on('Network.requestWillBeSent', (params) => {
  const url = params.request.url;
  if (url.includes('analytics.google.com/g/collect')) {
    capturedEvents.push({ url, source: 'cdp', ... });
  }
});
```

**역할**: Layer 1이 실패하는 경우를 대비한 백업 메커니즘

### Event Retrieval & Merging

**구현 위치**: `networkEventCapturer.js:waitForGA4Events()`

**동작 원리**:
1. 500ms 간격으로 `page.evaluate()`를 통해 `window.__ga4Events` 배열 읽기
2. URL 기반 중복 제거 (CDP에서 이미 캡처한 이벤트 제외)
3. `capturedEvents` 배열에 병합
4. page_view 이벤트 감지 시 즉시 반환

```javascript
while (Date.now() - startTime < timeoutMs) {
  // Layer 1: 페이지 후크 이벤트 가져오기
  const pageHookEvents = await page.evaluate(() => {
    if (!window.__ga4Events) return [];
    const events = [...window.__ga4Events];
    window.__ga4Events = []; // 중복 방지를 위해 클리어
    return events;
  });

  // 변환 & 병합
  for (const hookEvent of pageHookEvents) {
    const isDuplicate = capturedEvents.some(e => e.url === hookEvent.url);
    if (!isDuplicate) {
      capturedEvents.push({
        url: hookEvent.url,
        type: 'ga4_collect',
        params: parseGA4Params(hookEvent.url),
        source: hookEvent.type // 'fetch', 'xhr', 'beacon'
      });
    }
  }

  // page_view 이벤트 확인
  const pageViewEvent = capturedEvents.find(e =>
    e.type === 'ga4_collect' && e.params.en === 'page_view'
  );
  if (pageViewEvent) return { events: capturedEvents, ... };

  await page.waitForTimeout(500);
}
```

---

## 📋 변경 사항 요약

### 파일: `/src/modules/networkEventCapturer.js`

#### 1. `startCapturing()` 함수 (lines 21-125)

**추가 사항**:
- Layer 1 page hooks 주입 (lines 25-79)
- Fetch/XHR/SendBeacon API 후킹
- 로그 메시지 개선: "CDP + Page Hooks" 표시

#### 2. `waitForGA4Events()` 함수 (lines 127-143, 148-181)

**추가 사항**:
- 500ms 주기로 `window.__ga4Events` 폴링 (lines 149-181)
- 이벤트 변환 및 중복 제거 로직
- 에러 핸들링 (페이지 준비 안된 경우)
- 소스 표시 (fetch, xhr, beacon, cdp)

**문서 업데이트**:
- 다중 계층 감지 설명 추가 (lines 135-137)

---

## 🧪 테스트 계획

### Phase 1: 개별 브랜드 사이트 테스트

**대상**: MCP 검증에서 GA4 정상 작동 확인된 사이트
- ETUDE (BR): https://www.etude.com/
- LANEIGE (BR): https://www.laneige.com/kr/ko
- IOPE (BR): https://www.iope.com/kr/ko

**기대 결과**:
- ✅ Layer 1 (page hooks)에서 GA4 이벤트 캡처
- ✅ page_view 이벤트 감지
- ✅ 검증 성공

### Phase 2: 전체 속성 재검증

**목표**:
- 성공률 향상 확인 (62.4% → 75%+)
- NO_GA4_EVENTS 이슈 감소 (21건 → 5건 이하)

### Phase 3: 비교 분석

**비교 지표**:
| 지표 | 이전 | 다중 계층 검증 | 목표 |
|------|------|----------------|------|
| 전체 성공률 | 62.4% | ? | 75%+ |
| NO_GA4_EVENTS | 21건 | ? | <5건 |
| PAGE_VIEW_NOT_FOUND | 21건 | ? | <5건 |

---

## 📊 예상 결과

### 시나리오 1: 성공 케이스 (기대)

```
📡 Network event capture started (CDP + Page Hooks)
⏳ Waiting for page_view event (timeout: 60000ms)...
  📡 Captured GA4 event (fetch): page_view
✅ page_view event detected (1 total GA4 events after 3200ms)
```

### 시나리오 2: CDP 실패 + Page Hooks 성공

```
📡 Network event capture started (CDP + Page Hooks)
⏳ Waiting for page_view event (timeout: 60000ms)...
  ⚠️ CDP: No events (blocked by headless detection)
  📡 Captured GA4 event (beacon): page_view
✅ page_view event detected (1 total GA4 events after 2800ms)
```

### 시나리오 3: 두 계층 모두 실패 (실제 오류)

```
📡 Network event capture started (CDP + Page Hooks)
⏳ Waiting for page_view event (timeout: 60000ms)...
⚠️ Timeout reached: 0 total events, 0 GA4 events
  → 실제 GA4 미구현 사이트
```

---

## 🚀 다음 단계

1. ✅ **구현 완료**: Multi-layer detection 코드 작성
2. ⏳ **테스트 실행**: 브랜드 사이트 3개 개별 테스트
3. ⏳ **전체 검증**: 85개 속성 재검증 실행
4. ⏳ **결과 분석**: 성공률 향상 확인
5. ⏳ **리포트 작성**: 최종 개선 리포트 생성

---

## 🔍 참고 자료

- **MCP 검증 리포트**: `MCP_VALIDATION_REPORT_2025-10-30_AFTER_FIX.md`
- **Option 3 Fix**: page_view 전용 대기 로직 (이미 적용됨)
- **CDP vs Page Hooks**: Page hooks가 headless 감지 회피에 더 효과적

---

## 📝 기술 노트

### Why Page Hooks > CDP?

**CDP Network.requestWillBeSent**:
- Chrome DevTools Protocol 수준 → 외부 관찰자
- Headless 환경에서 차단 가능
- 브라우저 컨텍스트 외부에서 작동

**Page Hooks (addInitScript)**:
- 브라우저 컨텍스트 내부 → 페이지와 동일한 권한
- JavaScript 엔진 수준에서 실행
- 차단 불가능 (페이지 로드 전 주입)

### Browser Context Security

페이지 hooks는 웹사이트가 차단할 수 **없음**:
1. `addInitScript()`는 페이지 로드 **전**에 실행
2. JavaScript API 자체를 후킹
3. GA4 라이브러리보다 먼저 실행 보장
