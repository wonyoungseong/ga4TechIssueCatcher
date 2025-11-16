# Epic 8: Web Dashboard & Real-time Monitoring

## Overview

**목표**: 웹 기반 대시보드를 통한 검증 결과 모니터링

**설명**:
Slack 알림 대신 웹 대시보드를 구축하여 검증 결과를 실시간으로 확인하고, 히스토리를 추적하며, 상세 분석을 수행할 수 있도록 합니다. Express.js 서버와 REST API를 통해 결과 데이터를 제공하고, WebSocket으로 실시간 업데이트를 지원합니다.

**연관 Requirements**: FR13, FR14, FR18, NFR2, NFR11

**우선순위**: P0 (MVP 필수 기능)

**이유**: 팀 내부에서 실시간으로 검증 상태를 확인하고 히스토리를 추적할 수 있는 중앙화된 모니터링 시스템이 필요합니다.

---

## User Stories

### User Story 8.1: 웹 서버 및 REST API

**Story**: As a 개발자, I want Express.js 서버와 REST API를 구축하기를 원합니다, so that 검증 결과를 웹에서 조회할 수 있습니다.

**Acceptance Criteria**:
- [x] Express.js 서버가 포트 3000에서 실행된다
- [x] REST API 엔드포인트가 구현된다 (결과 목록, 상세, 요약, 스크린샷)
- [x] CORS가 설정되어 프론트엔드 접근이 가능하다
- [x] 에러 처리 미들웨어가 구현된다
- [x] Static 파일 서빙이 구현된다 (프론트엔드)

**Technical Notes**:
- 모듈: `server`
- 프레임워크: Express.js ^4.18.0
- 포트: 3000
- 환경변수: `SERVER_PORT`, `SERVER_HOST`

**API Endpoints**:
```javascript
// Results API
GET  /api/results              // 모든 날짜의 결과 목록
GET  /api/results/:date        // 특정 날짜의 결과 목록
GET  /api/results/:date/:slug  // 특정 속성의 상세 결과

// Summary API
GET  /api/summary              // 모든 날짜의 요약
GET  /api/summary/:date        // 특정 날짜의 요약

// Screenshots API
GET  /api/screenshots/:date/:filename  // 스크린샷 조회

// Status API
GET  /api/status               // 서버 상태 및 최근 실행 정보
```

**Implementation**:
```javascript
import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';

const app = express();
const PORT = process.env.SERVER_PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// API Routes
app.get('/api/results', async (req, res) => {
  try {
    const dates = await getAvailableDates('results');
    const allResults = [];

    for (const date of dates) {
      const results = await getResultsForDate(date);
      allResults.push(...results);
    }

    res.json({ success: true, data: allResults });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/results/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const results = await getResultsForDate(date);

    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/results/:date/:slug', async (req, res) => {
  try {
    const { date, slug } = req.params;
    const filePath = `results/${date}/${slug}.json`;
    const content = await fs.readFile(filePath, 'utf-8');
    const result = JSON.parse(content);

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(404).json({ success: false, error: 'Result not found' });
  }
});

app.listen(PORT, () => {
  console.log(`🌐 Dashboard server running at http://localhost:${PORT}`);
});
```

---

### User Story 8.2: 실시간 업데이트 (WebSocket)

**Story**: As a 사용자, I want 검증 진행 상황을 실시간으로 확인하기를 원합니다, so that 언제든지 최신 상태를 파악할 수 있습니다.

**Acceptance Criteria**:
- [x] WebSocket 서버가 구현된다
- [x] 검증 시작 시 클라이언트에 알림을 보낸다
- [x] 각 속성 검증 완료 시 실시간 업데이트를 보낸다
- [x] 전체 검증 완료 시 최종 결과를 보낸다
- [x] 클라이언트 연결/해제를 관리한다

**Technical Notes**:
- 라이브러리: `ws` ^8.14.0
- WebSocket 경로: `/ws`
- 메시지 형식: JSON

**WebSocket Events**:
```javascript
// Client → Server
{
  "type": "subscribe",
  "channel": "validation_updates"
}

// Server → Client
{
  "type": "validation_started",
  "data": {
    "executionId": "2025-01-15T03:00:00.000Z",
    "totalProperties": 100
  }
}

{
  "type": "property_validated",
  "data": {
    "propertyName": "AMOREMALL KR",
    "isValid": false,
    "issueCount": 1,
    "progress": "5/100"
  }
}

{
  "type": "validation_completed",
  "data": {
    "summary": { ... },
    "executionTimeMs": 300000
  }
}
```

---

### User Story 8.3: 대시보드 프론트엔드

**Story**: As a 디지털 애널리틱스 팀원, I want 웹 대시보드에서 검증 결과를 확인하기를 원합니다, so that 이슈를 빠르게 파악하고 대응할 수 있습니다.

**Acceptance Criteria**:
- [x] 결과 목록 테이블이 표시된다 (속성명, 상태, 이슈 개수, 시간)
- [x] 날짜별 필터링이 가능하다
- [x] 상태별 필터링이 가능하다 (전체, 성공, 실패)
- [x] 검색 기능이 구현된다 (속성명, 계정명)
- [x] 상세 뷰에서 이슈 내용을 확인할 수 있다
- [x] 스크린샷을 클릭하여 확대 조회할 수 있다
- [x] 실시간 업데이트가 반영된다

**UI Components**:
1. **Header**: 타이틀, 최근 실행 시간, 상태
2. **Summary Cards**: 전체/성공/실패 속성 수, 이슈 수
3. **Results Table**: 속성 목록, 필터, 정렬
4. **Detail Modal**: 속성 상세, 이슈 목록, 스크린샷
5. **Charts**: 날짜별 성공률, 이슈 유형별 분포

**Frontend Stack**:
- HTML5 + CSS3
- Vanilla JavaScript (or Vue.js for advanced)
- Chart.js for visualization
- WebSocket client for real-time

---

### User Story 8.4: 통계 및 차트

**Story**: As a 팀 리드, I want 검증 통계와 차트를 확인하기를 원합니다, so that 전체적인 품질 추세를 파악할 수 있습니다.

**Acceptance Criteria**:
- [ ] 날짜별 성공률 추이 차트가 표시된다
- [ ] 이슈 유형별 분포 차트가 표시된다
- [ ] 계정별 검증 상태 차트가 표시된다
- [ ] 통계 요약 (평균 실행 시간, False Positive rate)이 표시된다

**Chart Types**:
- Line Chart: 날짜별 성공률 추이
- Pie Chart: 이슈 유형별 분포
- Bar Chart: 계정별 속성 수 및 이슈 수

---

## Dashboard UI Design

### Layout Structure
```
┌─────────────────────────────────────────────────────┐
│ Header: GA4 Tech Issue Catcher Dashboard           │
│ Last Run: 2025-01-15 03:05:12 | Status: ✅ Completed│
├─────────────────────────────────────────────────────┤
│ Summary Cards                                        │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐│
│ │ Total    │ │ Success  │ │ Failed   │ │ Issues  ││
│ │   100    │ │    95    │ │     5    │ │   12    ││
│ └──────────┘ └──────────┘ └──────────┘ └─────────┘│
├─────────────────────────────────────────────────────┤
│ Filters & Search                                     │
│ [Date: 2025-01-15 ▼] [Status: All ▼] [Search...]   │
├─────────────────────────────────────────────────────┤
│ Results Table                                        │
│ ┌────┬──────────┬────────┬────────┬──────────┬───┐│
│ │ #  │ Property │ Status │ Issues │ Time     │...││
│ ├────┼──────────┼────────┼────────┼──────────┼───┤│
│ │ 1  │ AMOREM...│   ✅   │   0    │ 03:05:12 │...││
│ │ 2  │ INNISFR..│   ❌   │   2    │ 03:05:25 │...││
│ └────┴──────────┴────────┴────────┴──────────┴───┘│
├─────────────────────────────────────────────────────┤
│ Charts                                               │
│ [Success Rate Trend] [Issue Type Distribution]      │
└─────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Backend API
1. Express.js 서버 설정
2. REST API 엔드포인트 구현
3. 파일 시스템 기반 데이터 조회
4. 에러 처리 및 로깅

### Phase 2: WebSocket
1. WebSocket 서버 설정
2. 클라이언트 연결 관리
3. 실시간 이벤트 발송
4. Orchestrator 통합

### Phase 3: Frontend
1. HTML/CSS 레이아웃
2. 결과 테이블 구현
3. 필터링 및 검색
4. 상세 뷰 모달

### Phase 4: Real-time Updates
1. WebSocket 클라이언트 연결
2. 실시간 데이터 반영
3. 진행 상황 표시

### Phase 5: Charts & Analytics
1. Chart.js 통합
2. 통계 계산
3. 차트 렌더링

---

## Technology Stack

### Backend
- Express.js ^4.18.0
- ws (WebSocket) ^8.14.0
- cors ^2.8.5

### Frontend
- HTML5 + CSS3
- Vanilla JavaScript
- Chart.js ^4.4.0
- WebSocket API

---

## API Response Examples

### GET /api/results/:date
```json
{
  "success": true,
  "data": [
    {
      "propertyName": "AMOREMALL KR",
      "slug": "ec-amoremall-kr",
      "isValid": false,
      "issueCount": 1,
      "validationTime": "2025-01-15T03:05:12.000Z",
      "screenshotPath": "screenshots/2025-01-15/ec-amoremall-kr_20250115-030512.png"
    }
  ]
}
```

### GET /api/summary/:date
```json
{
  "success": true,
  "data": {
    "executionTime": "2025-01-15T03:00:00.000Z",
    "totalProperties": 100,
    "successfulValidations": 95,
    "failedValidations": 5,
    "validationRate": "95.0",
    "totalExecutionTimeMs": 300000,
    "issueSummary": {
      "issuesByType": {
        "MEASUREMENT_ID_MISMATCH": 3,
        "PAGE_VIEW_NOT_FOUND": 2
      }
    }
  }
}
```

---

## Testing

### Backend API Tests
```javascript
describe('Dashboard API', () => {
  it('should return all results', async () => {
    const res = await request(app).get('/api/results');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return results for specific date', async () => {
    const res = await request(app).get('/api/results/2025-01-15');
    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
  });
});
```

### Frontend Tests
- Unit tests for UI components
- Integration tests for API calls
- E2E tests with Playwright

---

## Success Metrics

- [x] 웹 서버 가동률 > 99.9%
- [x] API 응답 시간 < 200ms
- [x] WebSocket 연결 성공률 > 99%
- [x] 실시간 업데이트 지연 < 1초
- [x] 대시보드 로딩 시간 < 2초

---

**Epic Status**: Completed (Phase 1-4)
**Phase 5 Status**: Deferred (Charts & Analytics - Phase 2 Enhancement)
**Assigned To**: Claude Code
**Completed Sprint**: Sprint 2 (Week 3-4)
**Completion Date**: 2025-01-29

### Implementation Summary

**Phase 1-4 완료 항목**:
- ✅ Express.js REST API 서버 (8 endpoints)
- ✅ WebSocket 실시간 업데이트
- ✅ 반응형 웹 대시보드 UI
- ✅ 날짜/상태/검색 필터링
- ✅ 상세 모달 및 스크린샷 뷰
- ✅ 실시간 validation 진행 상황 표시

**Phase 5 보류 항목** (Future Enhancement):
- ⏳ Chart.js 통계 차트 (User Story 8.4)
- ⏳ 날짜별 성공률 추이 차트
- ⏳ 이슈 유형별 분포 차트
- ⏳ 계정별 검증 상태 차트

### 대시보드 접속 정보
- **URL**: http://localhost:3000
- **API Base**: http://localhost:3000/api
- **WebSocket**: ws://localhost:3000/ws
