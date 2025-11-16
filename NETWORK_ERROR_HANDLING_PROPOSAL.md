# 일시적 네트워크 오류 처리 방안

## 📋 문제 정의

**현재 상황**:
- Phase 1 (10초) 실패 → Phase 2 (80초) 재시도
- Phase 2도 실패하는 경우 영구 실패로 처리됨
- Innisfree KR 사례: 일시적 네트워크 문제로 80초 초과했으나, 실제로는 1.3초에 로딩되는 정상 사이트

**핵심 문제**:
- 일시적 네트워크 문제와 실제 사이트 문제를 구분하지 못함
- 재시도 기회 부족 (현재 2번: Phase 1, Phase 2)

---

## 💡 해결 방안 옵션

### Option 1: Phase 3 추가 (가장 간단)

**개념**: 크롤 완료 후 일정 시간 대기 후 Phase 2 실패 항목 재시도

**구현**:
```javascript
// orchestrator.js에 추가

// Phase 2 완료 후
if (phase2FailedProperties.length > 0) {
  console.log(`\n⏰ Waiting 5 minutes before Phase 3 (network recovery)...`);
  await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));

  console.log(`\n📍 PHASE 3: Retrying ${phase2FailedProperties.length} network-failed properties...`);

  for (const property of phase2FailedProperties) {
    await validateSingleProperty(browser, property, dateStr, 3, phase2Timeout);
  }
}
```

**장점**:
- 간단한 구현 (20-30줄 코드 추가)
- 네트워크 복구 시간 확보 (5-10분 대기)
- 별도 인프라 불필요

**단점**:
- 크롤 시간 증가 (5-10분 대기)
- 실패 항목이 많으면 Phase 3도 오래 걸림

---

### Option 2: 재시도 대기열 + 수동/자동 실행 (권장) ⭐

**개념**: Phase 2 실패 항목을 별도 테이블에 저장하고 나중에 재시도

**데이터베이스 스키마**:
```sql
CREATE TABLE retry_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID REFERENCES properties(id),
  crawl_run_id UUID REFERENCES crawl_runs(id),
  failure_reason TEXT,
  failure_count INTEGER DEFAULT 1,
  last_attempt_at TIMESTAMP,
  next_retry_at TIMESTAMP,
  status TEXT, -- 'pending', 'retrying', 'resolved', 'permanent_failure'
  created_at TIMESTAMP DEFAULT NOW()
);
```

**구현 - Phase 2 실패 시 대기열 추가**:
```javascript
// orchestrator.js - Phase 2 실패 처리
if (phase2Result.validation_status === 'timeout' || phase2Result.validation_status === 'failed') {
  // Add to retry queue
  await supabase
    .from('retry_queue')
    .insert({
      property_id: property._supabaseId,
      crawl_run_id: runId,
      failure_reason: phase2Result.issue_summary,
      next_retry_at: new Date(Date.now() + 30 * 60 * 1000) // 30분 후
    });

  console.log(`  📋 Added to retry queue (will retry in 30 minutes)`);
}
```

**구현 - 재시도 실행 (자동)**:
```javascript
// src/modules/retryQueue.js (신규 파일)

export async function processRetryQueue() {
  const { data: pendingRetries } = await supabase
    .from('retry_queue')
    .select('*, properties(*)')
    .eq('status', 'pending')
    .lte('next_retry_at', new Date().toISOString())
    .limit(50);

  if (!pendingRetries || pendingRetries.length === 0) {
    console.log('✅ No pending retries');
    return;
  }

  console.log(`🔄 Processing ${pendingRetries.length} retry items...`);

  // Retry validation
  for (const retry of pendingRetries) {
    const result = await validateSingleProperty(
      browser,
      retry.properties,
      dateStr,
      'retry',
      80000 // 80초
    );

    if (result.validation_status === 'passed') {
      // Success - remove from queue
      await supabase
        .from('retry_queue')
        .update({ status: 'resolved' })
        .eq('id', retry.id);
    } else if (retry.failure_count >= 3) {
      // Permanent failure after 3 attempts
      await supabase
        .from('retry_queue')
        .update({ status: 'permanent_failure' })
        .eq('id', retry.id);
    } else {
      // Schedule next retry (exponential backoff)
      const nextRetry = new Date(Date.now() + Math.pow(2, retry.failure_count) * 30 * 60 * 1000);

      await supabase
        .from('retry_queue')
        .update({
          failure_count: retry.failure_count + 1,
          next_retry_at: nextRetry.toISOString()
        })
        .eq('id', retry.id);
    }
  }
}
```

**구현 - 스케줄러 등록**:
```javascript
// src/server.js에 추가

import { processRetryQueue } from './modules/retryQueue.js';

// 30분마다 재시도 대기열 처리
setInterval(async () => {
  try {
    await processRetryQueue();
  } catch (error) {
    console.error('❌ Retry queue processing failed:', error.message);
  }
}, 30 * 60 * 1000); // 30분
```

**구현 - 수동 실행 API**:
```javascript
// src/routes/retry.js (신규 파일)

router.post('/retry-queue/process', async (req, res) => {
  try {
    await processRetryQueue();
    res.json({ success: true, message: 'Retry queue processed' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

**장점**:
- 네트워크 복구 시간 확보 (30분 - 2시간 간격)
- Exponential backoff로 효율적 재시도
- 크롤 시간에 영향 없음 (비동기 처리)
- 수동 실행 가능
- 영구 실패와 일시적 실패 구분 가능
- 재시도 이력 추적 가능

**단점**:
- 구현 복잡도 높음 (새 테이블, 스케줄러 필요)
- 재시도 로직 관리 필요

---

### Option 3: 스마트 재시도 (네트워크 오류 감지)

**개념**: 실패 원인을 분석하여 네트워크 오류만 재시도

**구현**:
```javascript
function isNetworkError(error) {
  const networkKeywords = [
    'timeout',
    'ECONNREFUSED',
    'ENOTFOUND',
    'ETIMEDOUT',
    'network error',
    'connection refused',
    'connection reset'
  ];

  const errorMsg = error.message.toLowerCase();
  return networkKeywords.some(keyword => errorMsg.includes(keyword.toLowerCase()));
}

// Phase 2 실패 처리
if (isNetworkError(error)) {
  console.log(`  🌐 Network error detected - queuing for delayed retry`);
  await addToRetryQueue(property, 'network_error');
} else {
  console.log(`  ❌ Site error detected - marking as permanent failure`);
  // 영구 실패로 처리
}
```

**장점**:
- 정확한 실패 원인 구분
- 불필요한 재시도 방지

**단점**:
- 오류 분류 로직 복잡
- 모든 네트워크 오류를 감지하기 어려움

---

## 🎯 권장 구현 방안

**추천: Option 2 (재시도 대기열) + Option 3 (스마트 감지) 조합**

### 구현 단계

**Phase 1: 재시도 대기열 기본 구현** (우선순위 높음)
1. `retry_queue` 테이블 생성
2. Phase 2 실패 시 대기열 추가
3. 수동 재시도 API 엔드포인트
4. 프론트엔드에 재시도 버튼 추가

**Phase 2: 자동 스케줄러 추가** (우선순위 중간)
1. 30분마다 자동 실행 스케줄러
2. Exponential backoff 구현
3. 재시도 횟수 제한 (최대 3회)

**Phase 3: 스마트 감지 개선** (우선순위 낮음)
1. 네트워크 오류 vs 사이트 오류 구분
2. 오류 타입별 재시도 전략 최적화

---

## 📊 예상 효과

**현재 시스템**:
- Innisfree KR: Phase 2 실패 → 영구 실패 ❌
- 재시도 기회: 2회 (Phase 1, Phase 2)

**Option 2 구현 후**:
- Innisfree KR: Phase 2 실패 → 30분 후 재시도 → 통과 ✅
- 재시도 기회: 최대 5회 (Phase 1, Phase 2, Retry 1-3)
- 일시적 실패 복구율: 예상 70-90%

---

## 🔧 구현 우선순위

### Immediate (1-2일)
- [ ] `retry_queue` 테이블 생성
- [ ] Phase 2 실패 시 대기열 추가 로직
- [ ] 수동 재시도 API 엔드포인트

### Short-term (1주)
- [ ] 자동 스케줄러 구현 (30분 간격)
- [ ] Exponential backoff 구현
- [ ] 프론트엔드 재시도 UI

### Long-term (2-4주)
- [ ] 네트워크 오류 스마트 감지
- [ ] 재시도 통계 대시보드
- [ ] 재시도 전략 최적화

---

## 💻 최소 구현 코드 (Quick Win)

가장 간단한 구현 (Option 1 변형):

```javascript
// orchestrator.js - Phase 2 완료 후 추가

const phase2NetworkFailures = phase2Results.filter(r =>
  r.validation_status === 'timeout' &&
  r.execution_time_ms > 75000 // 75초 이상은 네트워크 문제 가능성 높음
);

if (phase2NetworkFailures.length > 0) {
  console.log(`\n⏰ Found ${phase2NetworkFailures.length} potential network failures`);
  console.log(`   Waiting 10 minutes before final retry...`);

  await new Promise(resolve => setTimeout(resolve, 10 * 60 * 1000));

  console.log(`\n🔄 FINAL RETRY: Re-validating network failure suspects...`);

  for (const failure of phase2NetworkFailures) {
    const property = allProperties.find(p => p._supabaseId === failure.property_id);
    const result = await validateSingleProperty(browser, property, dateStr, 'final', 80000);

    if (result.validation_status === 'passed') {
      console.log(`  ✅ ${property.propertyName} recovered!`);
    }
  }
}
```

**장점**: 5분 내 구현 가능, 즉시 효과
**단점**: 크롤 시간 +10분, 재시도 횟수 제한적

---

**결론**: Option 2 (재시도 대기열)가 가장 효과적이지만, 빠른 개선이 필요하다면 최소 구현 코드로 시작하고 점진적으로 Option 2로 발전시키는 것을 권장합니다.
