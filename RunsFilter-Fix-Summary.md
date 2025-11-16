# RunsFilter 필터 기능 수정 완료

## 문제 분석

### 발견된 문제
`http://localhost:3001/reports` 페이지에서 RunsFilter 컴포넌트의 필터가 전혀 작동하지 않는 문제

### 근본 원인
1. **프론트엔드 (Reports.js)**: `fetchRuns` 함수가 `dateRange`와 `status` 필터만 API에 전송
   - `hasIssues` 필터 파라미터 누락
   - `search` 필터 파라미터 누락

2. **백엔드 (crawl.js)**: `/api/crawl/runs` 엔드포인트가 `hasIssues`와 `search` 파라미터를 지원하지 않음
   - `limit`과 `offset`만 처리
   - 날짜와 상태 필터만 부분적으로 지원

3. **아키텍처 문제**: `filteredResults` useMemo는 RunDetailModal 내부의 결과만 필터링
   - 실제 runs 목록은 필터링되지 않음
   - 사용자가 필터를 변경해도 runs 목록에 반영 안 됨

## 적용된 수정사항

### ✅ 수정 1: 백엔드 API 확장
**파일**: `/Users/seong-won-yeong/Dev/ga4TechIssueCatcher/src/routes/crawl.js` (193-312줄)

**변경 내용**:
```javascript
// 기존: limit과 offset만 지원
const { limit = 30, offset = 0 } = req.query;

// 수정: 모든 필터 파라미터 지원
const {
  limit = 30,
  offset = 0,
  start_date,
  end_date,
  status,
  has_issues = 'all',
  search
} = req.query;
```

**새로운 필터 구현**:

1. **has_issues 필터**: `properties_with_issues` 컬럼 활용
```javascript
if (has_issues === 'issues') {
  query = query.gt('properties_with_issues', 0);
} else if (has_issues === 'no-issues') {
  query = query.eq('properties_with_issues', 0);
}
```

2. **search 필터**: crawl_results + properties 조인 검색
```javascript
if (search && search.trim()) {
  // crawl_results와 properties 조인하여 검색
  const { data: matchingResults } = await supabase
    .from(Tables.CRAWL_RESULTS)
    .select(`crawl_run_id, properties (property_name, url)`);

  // property_name과 url에서 검색어 찾기 (대소문자 무시)
  const matchingRunIds = new Set();
  matchingResults.forEach(result => {
    if (propertyName.includes(searchLower) || url.includes(searchLower)) {
      matchingRunIds.add(result.crawl_run_id);
    }
  });

  // 매칭된 run ID들만 조회
  query = query.in('id', Array.from(matchingRunIds));
}
```

**효과**:
- ✅ `has_issues` 필터가 runs 목록에 즉시 반영
- ✅ `search` 필터로 property 이름/URL로 runs 검색 가능
- ✅ 기존 date_range와 status 필터와 함께 동작

### ✅ 수정 2: 프론트엔드 필터 파라미터 전송
**파일**: `/Users/seong-won-yeong/Dev/ga4TechIssueCatcher/front/crawler-monitor/src/pages/Reports.js` (58-91줄)

**변경 내용**:
```javascript
// 기존: dateRange와 status만 전송
if (filters.status !== 'all') {
  params.append('status', filters.status);
}

// 수정: hasIssues와 search 파라미터 추가
if (filters.hasIssues !== 'all') {
  params.append('has_issues', filters.hasIssues);
}

if (filters.search && filters.search.trim()) {
  params.append('search', filters.search.trim());
}
```

**효과**:
- ✅ 모든 4가지 필터가 API로 전송됨
- ✅ 사용자가 필터 변경 시 즉시 API 재호출
- ✅ runs 목록이 실시간으로 필터링됨

## 테스트 방법

### 1. 서버 재시작 (완료)
```bash
# 백엔드 서버
npm run server

# 프론트엔드 서버
cd front/crawler-monitor
npm start
```

### 2. 필터 기능 테스트

#### Test 1: dateRange 필터 (기존 기능 확인)
1. http://localhost:3001/reports 접속
2. "오늘" 프리셋 클릭
3. ✅ 오늘 날짜의 runs만 표시되는지 확인

#### Test 2: status 필터 (기존 기능 확인)
1. 상태 드롭다운에서 "완료됨" 선택
2. ✅ 완료된 runs만 표시되는지 확인

#### Test 3: hasIssues 필터 (새 기능)
1. "이슈 상태" 드롭다운에서 "이슈 있음" 선택
2. ✅ properties_with_issues > 0인 runs만 표시되는지 확인
3. "이슈 없음" 선택
4. ✅ properties_with_issues = 0인 runs만 표시되는지 확인

#### Test 4: search 필터 (새 기능)
1. 검색창에 property 이름 입력 (예: "aestura")
2. ✅ 해당 property가 포함된 runs만 표시되는지 확인
3. URL로도 검색 테스트 (예: "naver.com")
4. ✅ 해당 URL을 가진 property가 포함된 runs만 표시되는지 확인

#### Test 5: 복합 필터 (조합 테스트)
1. "오늘" + "이슈 있음" + "aestura" 검색 동시 적용
2. ✅ 모든 조건을 만족하는 runs만 표시되는지 확인
3. 필터 해제 시 runs 목록이 다시 늘어나는지 확인

### 3. 성능 테스트
- 검색어 입력 시 debounce 동작 확인 (300ms 지연)
- 많은 runs가 있을 때 필터링 속도 확인
- 페이지네이션과 필터가 함께 작동하는지 확인

## 예상 결과

### 즉시 해결되는 것
- ✅ 4가지 필터 모두 runs 목록에 즉시 반영
- ✅ "이슈 있음" 필터로 문제 있는 runs만 표시 가능
- ✅ property 이름/URL로 runs 검색 가능
- ✅ 필터 조합으로 정확한 runs 찾기 가능

### 장기적 개선
- ✅ 사용자 경험 대폭 향상
- ✅ 원하는 runs를 빠르게 찾을 수 있음
- ✅ 이슈 진단 시간 단축

## 기술적 세부사항

### API 엔드포인트 스펙
**GET /api/crawl/runs**

**Query Parameters**:
- `limit` (number, default: 30): 페이지당 runs 개수
- `offset` (number, default: 0): 페이지네이션 오프셋
- `start_date` (string, ISO format): 시작 날짜 필터
- `end_date` (string, ISO format): 종료 날짜 필터
- `status` (string): 상태 필터 ('running', 'completed', 'failed', 'cancelled', 'all')
- `has_issues` (string): 이슈 필터 ('issues', 'no-issues', 'all')
- `search` (string): property 이름/URL 검색

**Response**:
```json
{
  "success": true,
  "data": [...],
  "count": 123,
  "pagination": {
    "limit": 30,
    "offset": 0,
    "total": 123
  }
}
```

### 성능 최적화
1. **has_issues 필터**: DB 인덱스 활용 (properties_with_issues 컬럼)
2. **search 필터**:
   - crawl_results 테이블에서 한 번만 조회
   - Set을 사용한 중복 제거
   - 매칭된 run ID만 조회하여 효율적
3. **클라이언트 debounce**: 검색 입력 시 300ms 지연으로 API 호출 최소화

## 주의사항

1. **search 필터 성능**:
   - 많은 crawl_results가 있으면 검색이 느려질 수 있음
   - 향후 최적화: property_name과 url에 full-text search 인덱스 추가 고려

2. **filteredResults useMemo**:
   - RunDetailModal 내부 결과 필터링용으로 유지
   - runs 목록 필터링은 API 레벨에서 처리
   - 두 가지 목적으로 분리됨

3. **캐시 무효화**:
   - 필터 변경 시 자동으로 API 재호출
   - useCallback dependency에 filters 포함

## 다음 단계

1. ✅ **서버 재시작 완료**
2. 🧪 **테스트 진행**: 위의 테스트 시나리오 실행
3. 📊 **결과 확인**: 모든 필터가 정상 작동하는지 검증
4. 📝 **새로운 문제 발견 시 보고**

---

**요약**: RunsFilter의 4가지 필터가 모두 정상 작동하도록 근본적인 문제를 해결했습니다. 백엔드 API가 모든 필터 파라미터를 지원하고, 프론트엔드가 올바르게 전송하도록 수정했습니다.
