# Frontend Integration - 사전 진단 리포트

## 🔍 현재 상태 분석

### 기존 Epic 구조
PRD 분석 결과, 기존 Epic 1-7이 정의되어 있음:
- **Epic 1**: CSV Property Management System (P0) ✅ 완료
- **Epic 2**: Browser Automation & Parallel Crawling (P0) ✅ 완료
- **Epic 3**: GA4/GTM Configuration Validation (P0) ✅ 완료
- **Epic 4**: Result Storage & Screenshot Management (P1) ✅ 완료
- **Epic 5**: Alert & Notification System (P0) ✅ 완료
- **Epic 6**: Error Handling & Retry Logic (P1) ✅ 완료
- **Epic 7**: Logging & Monitoring (P1) ✅ 완료
- **Epic 8**: Web Server & REST API (P1) ✅ 부분 완료 (Supabase 통합 추가됨)

### 백엔드 현황

#### ✅ 완료된 작업
1. **Supabase 통합**
   - 스키마 설계 및 테이블 생성 (properties, crawl_runs, crawl_results, property_status_history)
   - Supabase 클라이언트 설정 (src/utils/supabase.js)
   - 환경 변수 설정 (.env)
   - CSV 데이터 임포트 (85개 프로퍼티)

2. **백엔드 API**
   - Properties API (src/routes/properties.js)
     - GET /api/properties - 리스트 조회 (필터링, 검색, 페이징)
     - GET /api/properties/:id - 단일 조회
     - PUT /api/properties/:id/status - 상태 업데이트
     - GET /api/properties/summary/stats - 통계
   - Crawl API (src/routes/crawl.js)
     - POST /api/crawl/start - 크롤링 시작
     - POST /api/crawl/stop - 크롤링 중지
     - GET /api/crawl/status - 크롤링 상태
     - GET /api/crawl/runs - 실행 기록
   - Legacy API (src/server.js)
     - GET /api/status - 서버 상태
     - GET /api/results - 결과 조회
     - GET /api/summary - 요약

3. **WebSocket 서버**
   - WebSocket 서버 구성 (ws://localhost:3001/ws)
   - Broadcast 함수 구현
   - 실시간 크롤링 상태 전송

4. **순환 의존성 해결**
   - orchestrator.js → server.js 순환 import 제거
   - setBroadcast() 패턴으로 의존성 주입 구현

#### 🔄 서버 상태
- 서버: http://localhost:3001 ✅ 실행 중
- WebSocket: ws://localhost:3001/ws ✅ 연결 가능
- Supabase: ✅ 연결 성공
- 데이터: 85개 프로퍼티 ✅ 임포트 완료

### 프론트엔드 현황

#### 📁 프로젝트 구조
```
front/crawler-monitor/
├── src/
│   ├── App.js                    # 메인 앱 컴포넌트
│   ├── index.js                  # React 엔트리포인트
│   ├── components/
│   │   └── Sidebar.js           # 사이드바 네비게이션
│   ├── pages/
│   │   ├── Dashboard.js         # 대시보드 페이지
│   │   ├── Processing.js        # 크롤링 진행 페이지
│   │   ├── Reports.js           # 리포트 페이지
│   │   ├── SavedResults.js      # 저장된 결과 페이지
│   │   └── StatusManagement.js  # 상태 관리 페이지
│   └── utils/                    # 유틸리티 (비어있음)
└── package.json
```

#### 🔧 기술 스택
- React 19.2.0
- React Router DOM 7.9.5
- Recharts 3.3.0 (차트 라이브러리)
- Lucide React 0.552.0 (아이콘)

#### ⚠️ 누락된 구현
1. **API 클라이언트 없음**
   - fetch/axios 등 HTTP 클라이언트 미구성
   - API 엔드포인트 설정 없음
   - 에러 핸들링 없음

2. **WebSocket 연결 없음**
   - WebSocket 클라이언트 미구성
   - 실시간 업데이트 로직 없음

3. **데이터 플로우 미연결**
   - 모든 페이지가 Mock 데이터 사용 중
   - 실제 백엔드 API와 연동 안 됨

4. **상태 관리 없음**
   - Context API, Redux 등 상태 관리 미구성
   - 컴포넌트 간 데이터 공유 어려움

### 요구사항 분석 (사용자 제공)

1. **크롤링 시작 방식**: Dashboard에서 버튼 클릭 시 크롤링 시작
2. **실시간 업데이트**: Processing 페이지만 실시간, Dashboard는 완료 시 업데이트
3. **페이지 전환**: 크롤링은 페이지 이동과 무관하게 계속 진행
4. **상태 관리**: Supabase에 저장, 변경 이력 추적
5. **인증**: 불필요

### 기술적 고려사항

#### API 통신
- 백엔드: http://localhost:3001
- CORS 활성화됨 (cors 미들웨어 적용)
- JSON 응답 형식

#### WebSocket 통신
- 엔드포인트: ws://localhost:3001/ws
- 메시지 형식: JSON
- 이벤트 타입:
  - `connected`: 연결 성공
  - `crawl_status`: 크롤링 상태 업데이트
  - `subscribe_crawl_status`: 상태 구독 요청

#### 데이터 모델
**Properties**:
```javascript
{
  id: UUID,
  property_name: String,
  url: String,
  slug: String,
  expected_ga4_id: String,
  expected_gtm_id: String,
  current_status: 'normal' | 'issue' | 'debugging',
  brand: String,
  region: String,
  is_active: Boolean,
  created_at: Timestamp,
  updated_at: Timestamp
}
```

**Crawl Run**:
```javascript
{
  id: UUID,
  run_date: Date,
  status: 'running' | 'completed' | 'failed' | 'cancelled',
  total_properties: Number,
  completed_properties: Number,
  failed_properties: Number,
  properties_with_issues: Number,
  browser_pool_size: Number,
  started_at: Timestamp,
  completed_at: Timestamp,
  duration_seconds: Number
}
```

## 🎯 통합 전략

### Phase 1: 기반 설정 (Story 9.1)
1. API 클라이언트 설정
2. WebSocket 클라이언트 설정
3. 환경 변수 관리
4. 에러 핸들링 유틸리티

### Phase 2: Dashboard 통합 (Story 9.2)
1. 실시간 통계 API 연동
2. 크롤링 시작 버튼 구현
3. 최근 활동 표시

### Phase 3: Processing 통합 (Story 9.3)
1. WebSocket 실시간 업데이트
2. 진행 상황 표시
3. 로그 스트림

### Phase 4: Reports/Results 통합 (Story 9.4, 9.5)
1. API 데이터 페칭
2. 필터링 및 검색
3. 상세보기 모달

### Phase 5: StatusManagement 통합 (Story 9.6)
1. 상태 변경 API 연동
2. 변경 이력 조회
3. 벌크 업데이트

## 📊 예상 작업량

| Story | 예상 시간 | 우선순위 |
|-------|----------|---------|
| 9.1 API/WebSocket Setup | 2-3h | P0 |
| 9.2 Dashboard Integration | 2-3h | P0 |
| 9.3 Processing Real-time | 2-3h | P0 |
| 9.4 Reports Integration | 1-2h | P1 |
| 9.5 SavedResults Integration | 1-2h | P1 |
| 9.6 StatusManagement | 1-2h | P1 |
| **Total** | **9-15h** | |

## 🚀 다음 단계

**Epic 9: Frontend Dashboard Integration** 생성 및 진행
- Epic 번호: 9 (기존 1-8 다음)
- 우선순위: P0 (MVP 필수)
- 목표: 백엔드 API와 프론트엔드 통합하여 완전한 대시보드 시스템 구축
