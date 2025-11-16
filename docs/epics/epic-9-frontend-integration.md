# Epic 9: Frontend Dashboard Integration

## 📌 Epic 정보

**Epic ID**: 9
**제목**: Frontend Dashboard Integration
**우선순위**: P0 (MVP 필수)
**상태**: In Progress
**담당자**: Development Team
**생성일**: 2025-10-31

---

## 🎯 목표

백엔드 API 및 WebSocket과 React 프론트엔드를 통합하여 완전한 실시간 GA4 모니터링 대시보드 시스템을 구축합니다.

---

## 📝 설명

현재 React 프론트엔드는 Mock 데이터로 UI만 구현된 상태입니다. 백엔드 API (Supabase + Express)와 WebSocket 서버가 준비되었으므로, 이를 통합하여 실시간 크롤링 모니터링 및 프로퍼티 관리 기능을 완성합니다.

주요 통합 영역:
1. **API 클라이언트 설정**: REST API 통신 인프라
2. **WebSocket 연결**: 실시간 크롤링 상태 업데이트
3. **Dashboard**: 크롤링 시작, 실시간 통계
4. **Processing**: 실시간 진행 상황 및 로그
5. **Reports/SavedResults**: 검증 결과 조회 및 다운로드
6. **StatusManagement**: 프로퍼티 상태 관리

---

## 🔗 연관 Requirements

**Functional Requirements**:
- FR19 (신규): 프론트엔드는 백엔드 API와 통신하여 프로퍼티 데이터를 조회하고 상태를 업데이트해야 한다
- FR20 (신규): 프론트엔드는 WebSocket을 통해 크롤링 진행 상황을 실시간으로 수신해야 한다
- FR21 (신규): 사용자는 Dashboard에서 크롤링을 시작/중지할 수 있어야 한다
- FR22 (신규): Processing 페이지는 실시간으로 크롤링 상태를 표시해야 한다
- FR23 (신규): Reports 페이지는 검증 결과를 조회하고 필터링할 수 있어야 한다

**Non-Functional Requirements**:
- NFR13 (신규): 프론트엔드 빌드 크기는 500KB 이하를 유지해야 한다
- NFR14 (신규): 페이지 로딩 시간은 2초 이내여야 한다
- NFR15 (신규): WebSocket 연결 끊김 시 자동 재연결을 시도해야 한다

---

## 📋 User Stories

### Story 9.1: API Client & WebSocket Setup
**우선순위**: P0
**예상 시간**: 2-3h
**상태**: Pending

**목표**: REST API 통신 및 WebSocket 실시간 연결 인프라 구축

**Acceptance Criteria**:
- [ ] API 클라이언트 (fetch wrapper) 구현
  - Base URL 환경 변수 설정
  - Request/Response 인터셉터
  - 에러 핸들링 (4xx, 5xx)
  - 타임아웃 설정 (10초)
- [ ] WebSocket 클라이언트 구현
  - 연결/재연결 로직
  - 메시지 송수신 핸들러
  - 연결 상태 관리
  - 자동 재연결 (exponential backoff)
- [ ] 환경 변수 설정
  - REACT_APP_API_URL=http://localhost:3001
  - REACT_APP_WS_URL=ws://localhost:3001/ws
- [ ] 에러 핸들링 유틸리티
  - API 에러 포맷팅
  - 에러 토스트 표시

**Technical Notes**:
```javascript
// src/utils/api.js
const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001';

export const api = {
  get: (endpoint) => fetch(`${API_BASE}${endpoint}`),
  post: (endpoint, data) => fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }),
  // ...
};

// src/utils/websocket.js
class WebSocketClient {
  connect() { /* ... */ }
  subscribe(callback) { /* ... */ }
  send(data) { /* ... */ }
}
```

---

### Story 9.2: Dashboard Page Integration
**우선순위**: P0
**예상 시간**: 2-3h
**상태**: Pending

**목표**: Dashboard 페이지를 백엔드 API와 연동하여 실시간 통계 및 크롤링 제어 구현

**Acceptance Criteria**:
- [ ] 실시간 통계 API 연동
  - GET /api/properties/summary/stats
  - 총 프로퍼티, 정상/이슈/디버깅 카운트 표시
- [ ] 크롤링 시작 버튼 구현
  - POST /api/crawl/start 호출
  - 진행 중일 때 버튼 비활성화
  - 성공/실패 피드백 표시
- [ ] 최근 활동 표시
  - GET /api/crawl/runs 조회
  - 최근 5개 실행 기록 표시
  - 각 실행의 결과 요약
- [ ] 크롤링 완료 시 자동 업데이트
  - WebSocket 'crawl_status' 이벤트 수신
  - status='completed' 시 통계 갱신
- [ ] 차트 데이터 연동
  - Recharts 데이터 포맷으로 변환
  - 일별 이슈 트렌드 표시

**API Endpoints**:
- GET /api/properties/summary/stats
- POST /api/crawl/start
- GET /api/crawl/runs
- GET /api/crawl/status

---

### Story 9.3: Processing Page Real-time Updates
**우선순위**: P0
**예상 시간**: 2-3h
**상태**: Pending

**목표**: Processing 페이지에 WebSocket 실시간 업데이트 구현

**Acceptance Criteria**:
- [ ] WebSocket 연결 및 구독
  - 컴포넌트 마운트 시 WebSocket 연결
  - 'subscribe_crawl_status' 메시지 전송
- [ ] 실시간 진행 상황 표시
  - total_properties, completed_properties 업데이트
  - 진행률(%) 계산 및 표시
  - 현재 처리 중인 프로퍼티 표시
- [ ] 브라우저 풀 상태 표시
  - 브라우저 사용률 표시
  - 활성/대기 브라우저 수
- [ ] 로그 스트림 표시
  - 실시간 로그 메시지 추가
  - 최대 100개 로그 유지 (스크롤)
  - 로그 레벨별 색상 구분
- [ ] 페이지 전환 시에도 크롤링 계속 진행
  - 크롤링 상태는 서버에서 관리
  - 페이지 재방문 시 현재 상태 복원

**WebSocket Message Format**:
```javascript
{
  type: 'crawl_status',
  data: {
    isRunning: true,
    currentRun: { id, status, ... },
    progress: {
      total: 85,
      completed: 42,
      failed: 2,
      current: {
        propertyName: '[EC] INNISFREE - US',
        url: 'https://...'
      }
    }
  }
}
```

---

### Story 9.4: Reports Page API Integration
**우선순위**: P1
**예상 시간**: 1-2h
**상태**: Pending

**목표**: Reports 페이지를 API와 연동하여 검증 결과 조회 기능 구현

**Acceptance Criteria**:
- [ ] 검증 결과 리스트 조회
  - GET /api/results API 연동
  - 페이지네이션 (limit, offset)
  - 로딩 상태 표시
- [ ] 필터링 기능
  - 상태별 필터 (이슈/정상)
  - 날짜 범위 필터
  - 브랜드별 필터
- [ ] 검색 기능
  - 프로퍼티명으로 검색
  - 실시간 검색 (debounce 300ms)
- [ ] 상세보기 모달
  - 개별 검증 결과 상세 정보
  - 스크린샷 이미지 표시
  - 이슈 목록 표시
- [ ] 정렬 기능
  - 날짜, 프로퍼티명, 상태별 정렬

**API Endpoints**:
- GET /api/results?limit=50&offset=0
- GET /api/results/:date/:slug

---

### Story 9.5: SavedResults Page Integration
**우선순위**: P1
**예상 시간**: 1-2h
**상태**: Pending

**목표**: SavedResults 페이지를 API와 연동하여 저장된 결과 조회 및 다운로드 구현

**Acceptance Criteria**:
- [ ] 저장된 날짜 리스트 조회
  - GET /api/dates API 연동
  - 날짜별 실행 기록 표시
- [ ] 날짜별 결과 조회
  - GET /api/results/:date
  - 해당 날짜의 모든 검증 결과
- [ ] 요약 정보 표시
  - GET /api/summary/:date
  - 총 프로퍼티, 성공/실패 건수
  - 평균 실행 시간
- [ ] 다운로드 기능
  - JSON 파일 다운로드
  - CSV 내보내기
  - 날짜 범위 선택 다운로드
- [ ] 스크린샷 뷰어
  - 스크린샷 썸네일 그리드
  - 클릭 시 전체 이미지 표시
  - 이미지 다운로드

**API Endpoints**:
- GET /api/dates
- GET /api/results/:date
- GET /api/summary/:date
- GET /api/screenshots/:date/:filename

---

### Story 9.6: StatusManagement Page Integration
**우선순위**: P1
**예상 시간**: 1-2h
**상태**: Pending

**목표**: StatusManagement 페이지를 API와 연동하여 프로퍼티 상태 관리 구현

**Acceptance Criteria**:
- [ ] 프로퍼티 리스트 조회
  - GET /api/properties
  - 상태별 필터링 (normal/issue/debugging)
  - 활성/비활성 필터
- [ ] 상태 변경 기능
  - PUT /api/properties/:id/status
  - 상태 변경 사유 입력
  - 변경자 기록 (user/system)
  - 성공/실패 피드백
- [ ] 변경 이력 조회
  - GET /api/properties/:id/status-history
  - 시간순 정렬
  - 변경 사유 표시
- [ ] 벌크 상태 변경
  - 다중 선택
  - 일괄 상태 변경
  - 진행 상황 표시
- [ ] 검색 기능
  - 프로퍼티명, URL로 검색
  - 브랜드별 검색

**API Endpoints**:
- GET /api/properties
- GET /api/properties/:id
- PUT /api/properties/:id/status
- GET /api/properties/:id/status-history

---

## 🎨 UI/UX 개선사항

1. **로딩 상태**
   - Skeleton 로딩 UI
   - Spinner 컴포넌트
   - 프로그레스 바

2. **에러 핸들링**
   - Toast 알림 (성공/실패)
   - 에러 메시지 표시
   - Retry 버튼

3. **반응형 디자인**
   - 모바일 대응
   - 테블릿 대응

4. **접근성**
   - 키보드 네비게이션
   - ARIA 속성
   - 포커스 관리

---

## 📊 진행 현황

| Story | 상태 | 진행률 | 담당자 |
|-------|------|--------|--------|
| 9.1 API/WebSocket Setup | Pending | 0% | - |
| 9.2 Dashboard Integration | Pending | 0% | - |
| 9.3 Processing Real-time | Pending | 0% | - |
| 9.4 Reports Integration | Pending | 0% | - |
| 9.5 SavedResults Integration | Pending | 0% | - |
| 9.6 StatusManagement | Pending | 0% | - |

---

## 🧪 테스트 계획

### Unit Tests
- API 클라이언트 함수
- WebSocket 메시지 핸들러
- 데이터 변환 유틸리티

### Integration Tests
- API 통신 플로우
- WebSocket 연결 및 재연결
- 에러 핸들링

### E2E Tests
- 크롤링 시작 → 진행 → 완료 플로우
- 상태 변경 플로우
- 결과 조회 플로우

---

## 📝 참고 문서

- [Frontend Integration Assessment](../frontend-integration-assessment.md)
- [Backend API Documentation](../../src/routes/README.md)
- [Supabase Schema](../../supabase/migrations/001_initial_schema.sql)
- [WebSocket Protocol](../websocket-protocol.md)

---

## 🚀 완료 조건

- [ ] 모든 Story AC 완료
- [ ] 단위 테스트 통과
- [ ] E2E 테스트 통과
- [ ] 코드 리뷰 완료
- [ ] 문서 업데이트 완료
- [ ] 프로덕션 배포 가능

---

## 📌 Notes

- 백엔드 서버는 http://localhost:3001에서 실행 중
- Supabase에 85개 프로퍼티 데이터 준비됨
- WebSocket은 ws://localhost:3001/ws로 연결
- CORS 설정 완료
