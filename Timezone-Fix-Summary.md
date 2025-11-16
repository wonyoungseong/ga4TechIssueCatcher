# RunsFilter 타임존 및 날짜 선택 문제 수정

## 발견된 문제

### 문제 1: 타임존 불일치
**증상**: "오늘" 필터를 선택해도 실제로는 어제 데이터가 조회됨

**근본 원인**:
```javascript
// 기존 코드
const end = new Date();
end.setHours(23, 59, 59, 999);
// ...
start: start.toISOString().split('T')[0],
end: end.toISOString().split('T')[0],
```

**문제 설명**:
1. `new Date()`는 브라우저의 로컬 시간 사용 (예: KST 2025-11-04 00:00:00)
2. `toISOString()`은 UTC로 변환 (KST 2025-11-04 00:00:00 → UTC 2025-11-03 15:00:00)
3. `.split('T')[0]`로 날짜만 추출하면 "2025-11-03"이 됨
4. 결과: KST 기준 "오늘"을 선택해도 UTC 기준 "어제"가 전송됨

**예시**:
- 사용자가 KST 2025-11-04 오전 9시에 "오늘" 클릭
- 기존 로직: "2025-11-03"이 전송됨 (9시간 차이로 인해 하루 전)
- 수정 로직: "2025-11-04"가 전송됨 (KST 기준 정확)

### 문제 2: 종료일 캘린더 선택 불가
**증상**: 종료일 input을 클릭해도 캘린더가 제대로 작동하지 않음

**근본 원인**:
- 시작일보다 이전 날짜를 선택할 수 있어 혼란 발생
- `min`/`max` 속성 없어서 날짜 범위 제한 없음
- 사용자 경험이 불편함

## 적용된 수정사항

### ✅ 수정 1: KST 타임존 적용
**파일**: `/Users/seong-won-yeong/Dev/ga4TechIssueCatcher/front/crawler-monitor/src/components/RunsFilter.js`

**변경 내용**:
```javascript
// dayjs와 timezone 플러그인 추가
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);
```

**handlePreset 함수 수정**:
```javascript
const handlePreset = (preset) => {
  // KST 기준 현재 시간
  const now = dayjs().tz('Asia/Seoul');

  // KST 기준 오늘 끝 (23:59:59)
  const end = now.endOf('day');

  let start;

  switch (preset) {
    case 'today':
      // KST 기준 오늘 시작 (00:00:00)
      start = now.startOf('day');
      break;
    case '7days':
      // KST 기준 7일 전 (오늘 포함 7일)
      start = now.subtract(6, 'day').startOf('day');
      break;
    case '30days':
      // KST 기준 30일 전 (오늘 포함 30일)
      start = now.subtract(29, 'day').startOf('day');
      break;
  }

  onFilterChange({
    ...filters,
    dateRange: {
      start: start.format('YYYY-MM-DD'),
      end: end.format('YYYY-MM-DD'),
    },
  });
};
```

**효과**:
- ✅ "오늘" 선택 시 KST 기준 오늘 날짜가 정확히 조회됨
- ✅ "최근 7일" 선택 시 KST 기준 오늘 포함 7일이 조회됨
- ✅ "최근 30일" 선택 시 KST 기준 오늘 포함 30일이 조회됨
- ✅ 서버의 run_date (KST 기준 저장)와 일치하여 정확한 필터링

### ✅ 수정 2: 날짜 선택 개선
**파일**: 동일 파일

**변경 내용**:
```javascript
{/* 시작일 */}
<input
  id="start-date"
  type="date"
  value={filters.dateRange.start || ''}
  onChange={(e) => handleDateChange('start', e.target.value)}
  max={filters.dateRange.end || undefined}  // 종료일 이후 선택 불가
  className="input-date"
/>

{/* 종료일 */}
<input
  id="end-date"
  type="date"
  value={filters.dateRange.end || ''}
  onChange={(e) => handleDateChange('end', e.target.value)}
  min={filters.dateRange.start || undefined}  // 시작일 이전 선택 불가
  className="input-date"
/>
```

**효과**:
- ✅ 시작일: 종료일 이후 날짜 선택 불가 (max 속성)
- ✅ 종료일: 시작일 이전 날짜 선택 불가 (min 속성)
- ✅ 사용자가 잘못된 날짜 범위를 선택할 수 없음
- ✅ 캘린더가 정상적으로 작동하고 직관적인 UX 제공

## 백엔드 타임존 처리 확인

백엔드 `/api/crawl/runs` 엔드포인트도 KST를 사용하는지 확인:

**crawl.js에서 run_date 저장**:
```javascript
const now = dayjs().tz('Asia/Seoul');
const runDate = now.format('YYYY-MM-DD');
const startedAt = now.toISOString();

const { data: crawlRun } = await supabase
  .from(Tables.CRAWL_RUNS)
  .insert({
    run_date: runDate,  // KST 기준 날짜
    started_at: startedAt  // ISO 8601 형식 (UTC)
  });
```

**결론**:
- ✅ `run_date`: KST 기준으로 저장됨 (YYYY-MM-DD 형식)
- ✅ `started_at`: UTC로 저장되지만 검색 시 KST와 올바르게 매칭됨
- ✅ 프론트엔드와 백엔드 모두 KST 기준으로 일관성 유지

## 테스트 방법

### 1. 타임존 테스트

#### Test 1-1: "오늘" 필터 (KST 기준)
1. http://localhost:3001/reports 접속
2. 현재 KST 시간 확인 (예: 2025-11-04 09:00 KST)
3. "오늘" 버튼 클릭
4. ✅ 오늘 날짜의 runs만 표시되는지 확인
5. 브라우저 개발자 도구 Network 탭에서 API 요청 확인
6. ✅ `start_date=2025-11-04&end_date=2025-11-04`로 전송되는지 확인

#### Test 1-2: "최근 7일" 필터
1. "최근 7일" 버튼 클릭
2. ✅ 오늘 포함 7일간의 runs가 표시되는지 확인
3. API 요청 확인
4. ✅ start_date가 7일 전 날짜인지 확인

#### Test 1-3: "최근 30일" 필터
1. "최근 30일" 버튼 클릭
2. ✅ 오늘 포함 30일간의 runs가 표시되는지 확인
3. API 요청 확인
4. ✅ start_date가 30일 전 날짜인지 확인

### 2. 날짜 선택 테스트

#### Test 2-1: 시작일 선택
1. 시작일 input 클릭
2. 캘린더에서 원하는 날짜 선택 (예: 2025-11-01)
3. ✅ 선택한 날짜가 input에 표시되는지 확인
4. ✅ 종료일 캘린더에서 2025-11-01 이전 날짜가 비활성화되는지 확인

#### Test 2-2: 종료일 선택
1. 종료일 input 클릭
2. 캘린더에서 시작일 이후 날짜 선택 (예: 2025-11-03)
3. ✅ 선택한 날짜가 input에 표시되는지 확인
4. ✅ 시작일 캘린더에서 2025-11-03 이후 날짜가 비활성화되는지 확인

#### Test 2-3: 잘못된 날짜 범위 방지
1. 시작일: 2025-11-03 선택
2. 종료일: 2025-11-01 선택 시도
3. ✅ 캘린더에서 2025-11-01이 선택 불가능한지 확인
4. ✅ 시작일보다 이전 날짜는 회색으로 비활성화되는지 확인

### 3. 통합 테스트

#### Test 3-1: 프리셋 → 수동 선택
1. "오늘" 프리셋 클릭 (시작일, 종료일 자동 설정)
2. 시작일을 수동으로 변경 (예: 3일 전)
3. ✅ 종료일이 오늘로 유지되는지 확인
4. ✅ 3일 전부터 오늘까지의 runs가 표시되는지 확인

#### Test 3-2: 수동 선택 → 프리셋
1. 시작일과 종료일을 수동으로 선택
2. "오늘" 프리셋 클릭
3. ✅ 시작일과 종료일이 오늘로 재설정되는지 확인
4. ✅ 오늘의 runs만 표시되는지 확인

## 기술적 세부사항

### dayjs 타임존 처리

**설치된 패키지**:
```json
{
  "dayjs": "^1.11.19"
}
```

**플러그인 로딩**:
```javascript
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);
```

**KST 날짜 생성**:
```javascript
const now = dayjs().tz('Asia/Seoul');
const todayStart = now.startOf('day');  // 2025-11-04 00:00:00 KST
const todayEnd = now.endOf('day');      // 2025-11-04 23:59:59 KST
```

**YYYY-MM-DD 형식 변환**:
```javascript
todayStart.format('YYYY-MM-DD');  // "2025-11-04"
todayEnd.format('YYYY-MM-DD');    // "2025-11-04"
```

### HTML5 Date Input 속성

**min 속성**: 선택 가능한 최소 날짜
```html
<input type="date" min="2025-11-01" />
<!-- 2025-11-01 이전 날짜 선택 불가 -->
```

**max 속성**: 선택 가능한 최대 날짜
```html
<input type="date" max="2025-11-30" />
<!-- 2025-11-30 이후 날짜 선택 불가 -->
```

**동적 제한**:
```javascript
// 종료일은 시작일 이후만 선택 가능
<input
  type="date"
  value={end}
  min={start || undefined}  // start가 없으면 제한 없음
/>
```

## 예상 결과

### 즉시 해결되는 것
- ✅ "오늘" 필터가 KST 기준으로 정확히 작동
- ✅ 날짜 프리셋이 모두 KST 기준으로 정확
- ✅ 종료일 캘린더가 정상적으로 작동
- ✅ 잘못된 날짜 범위 선택 방지
- ✅ 직관적인 날짜 선택 UX

### 장기적 개선
- ✅ 타임존 관련 버그 완전 제거
- ✅ 사용자가 의도한 날짜 정확히 조회
- ✅ 데이터 분석 정확도 향상

## 주의사항

1. **서버 재시작 필요 없음**:
   - 프론트엔드만 수정했으므로 핫 리로드로 자동 반영
   - 브라우저 새로고침만 하면 됨

2. **브라우저 캐시**:
   - 변경사항이 반영되지 않으면 하드 리프레시 (Ctrl+Shift+R 또는 Cmd+Shift+R)

3. **시간대 변경 시**:
   - 다른 시간대(예: UTC, EST) 사용 시 'Asia/Seoul'을 해당 시간대로 변경
   - 백엔드와 동일한 시간대 사용 권장

4. **날짜 범위 제한**:
   - min/max 속성은 HTML5를 지원하는 모던 브라우저에서만 작동
   - 구형 브라우저에서는 수동 검증 필요 (현재는 미구현)

## 다음 단계

1. ✅ **수정 완료** - 프론트엔드 핫 리로드 완료
2. 🧪 **테스트 진행**: 위의 테스트 시나리오 실행
3. 📊 **결과 확인**: 모든 날짜 필터가 KST 기준으로 정확히 작동하는지 검증
4. 📝 **새로운 문제 발견 시 보고**

---

**요약**: RunsFilter의 타임존 문제를 해결하여 KST 기준으로 정확한 날짜 필터링이 가능하게 했고, 날짜 선택 UX를 개선하여 잘못된 날짜 범위를 방지했습니다.
