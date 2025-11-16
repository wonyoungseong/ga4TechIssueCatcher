# Duplicate Results & Error Display Fix
# 중복 결과 및 오류 표시 개선

## 발견된 문제 | Problems Discovered

### 1. 중복 결과 문제 | Duplicate Results Issue
**Run ID**: `54bc59d6-acb4-4cc6-b070-9d1f4b8e15c2`

**문제점**:
- 총 결과: 89개
- 유니크 프로퍼티: 84개
- 기대값: 최대 85개
- **중복**: 5개 프로퍼티가 2번씩 저장됨

**중복된 프로퍼티**:
1. [EC] ILLIYOON - KR
2. [OTHERS] 뷰티스퀘어
3. [EC] AYUNCHEPRO - KR
4. [EC] INNISFREE - MY
5. [OTHERS] 아모레팩토리 오디오 가이드

**원인**:
- 첫 번째 검증 시도가 실패 (브라우저 종료 오류)
- 재시도 로직이 새로운 레코드로 저장
- API가 모든 중복 결과를 반환

### 2. 실패 원인 불명확 | Unclear Failure Reasons

**문제점**:
- 기술적 에러 메시지가 사용자에게 표시됨
- 예: "Target page, context or browser has been closed"
- 사용자가 실패 원인을 이해하기 어려움

**실패 유형**:
- 12개 실패 중 모두 `VALIDATION_ERROR` 타입
- 모두 "Target page, context or browser has been closed" 오류

## 해결 방법 | Solutions

### 1. API에서 중복 제거 | Remove Duplicates in API

**파일**: `/src/routes/crawl.js`

**변경사항**:
```javascript
// Remove duplicates - keep only the latest result per property (highest created_at)
const uniqueResults = [];
const seenProperties = new Set();

// Results are already sorted by created_at DESC, so first occurrence is most recent
for (const result of results) {
  if (!seenProperties.has(result.property_id)) {
    uniqueResults.push(result);
    seenProperties.add(result.property_id);
  }
}
```

**효과**:
- ✅ 각 프로퍼티당 최신 결과만 반환
- ✅ 89개 → 84개로 감소
- ✅ 중복 제거로 리포트가 정확해짐

### 2. 사용자 친화적 오류 메시지 | User-Friendly Error Messages

**파일**: `/src/routes/crawl.js`

**변경사항**:
```javascript
// Check if there was a validation error
const hasValidationError = result.validation_status === 'failed' || result.validation_status === 'error';

if (hasValidationError) {
  // Parse user-friendly error message
  let errorMessage = result.issue_summary || '검증 실패';

  // Convert technical errors to user-friendly messages
  if (errorMessage.includes('Target page, context or browser has been closed')) {
    errorMessage = '페이지 로딩 중 브라우저가 종료되었습니다';
  } else if (errorMessage.includes('page.goto')) {
    errorMessage = '페이지 접속 실패 (URL 확인 필요)';
  } else if (errorMessage.includes('DNS')) {
    errorMessage = 'DNS 오류 (도메인 확인 필요)';
  } else if (errorMessage.includes('ERR_ABORTED')) {
    errorMessage = '페이지 로딩이 중단되었습니다';
  } else if (errorMessage.includes('Timeout')) {
    errorMessage = '페이지 응답 시간 초과';
  } else if (errorMessage.includes('net::')) {
    errorMessage = '네트워크 연결 오류';
  }

  issues.push({
    type: 'VALIDATION_ERROR',
    message: errorMessage,
    details: result.issue_summary // Keep original for debugging
  });
}
```

**에러 메시지 매핑**:

| 기술적 에러 | 사용자 친화적 메시지 |
|------------|-------------------|
| Target page, context or browser has been closed | 페이지 로딩 중 브라우저가 종료되었습니다 |
| page.goto | 페이지 접속 실패 (URL 확인 필요) |
| DNS | DNS 오류 (도메인 확인 필요) |
| ERR_ABORTED | 페이지 로딩이 중단되었습니다 |
| Timeout | 페이지 응답 시간 초과 |
| net:: | 네트워크 연결 오류 |

**효과**:
- ✅ 사용자가 이해할 수 있는 메시지
- ✅ 원본 메시지는 `details`에 보존 (디버깅용)
- ✅ 실패 원인이 명확하게 표시됨

## 검증 | Verification

### 분석 스크립트 실행 | Run Analysis Script
```bash
node scripts/analyze-run-duplicates.js
```

**결과**:
```
=== Analyzing Run: 54bc59d6-acb4-4cc6-b070-9d1f4b8e15c2 ===

Total results: 89
Unique properties: 84
Expected max: 85

❌ PROBLEM: Duplicate results detected!
   Extra results: 5

=== Duplicate Properties Analysis ===
Duplicate properties: 5

[중복된 프로퍼티 목록]

=== Validation Status Summary ===
Passed: 77
Failed: 12
Error: 0

=== Failure Analysis ===
Total with issues/errors: 12

Issue Types:
  12x: VALIDATION_ERROR
     Example: [OTHERS] 디지털방판 모객시스템
     URL: https://new.amorecounselor.com/
     Status: failed
     Summary: Validation failed after retries: browser.newContext: Target page, context or browser has been closed
```

### API 테스트 | API Testing
```bash
# Test API endpoint
curl http://localhost:3001/api/crawl/runs/54bc59d6-acb4-4cc6-b070-9d1f4b8e15c2/results
```

**기대 결과**:
- 84개 유니크 결과 (중복 제거됨)
- 실패한 결과는 사용자 친화적 메시지 포함

## 향후 개선사항 | Future Improvements

### 1. 데이터베이스 레벨 중복 방지
```sql
-- Add unique constraint to prevent duplicates
CREATE UNIQUE INDEX idx_crawl_results_run_property_unique
ON crawl_results(crawl_run_id, property_id);
```

**주의**: 기존 중복 데이터 정리 후 적용 필요

### 2. 재시도 로직 개선
- 재시도 시 기존 레코드 업데이트 (새 레코드 생성 대신)
- 재시도 횟수 및 이력 추적

### 3. 더 많은 오류 메시지 매핑
```javascript
// 추가 에러 패턴 매핑
'net::ERR_CONNECTION_REFUSED' → '서버 연결 거부됨'
'net::ERR_CONNECTION_RESET' → '연결이 재설정되었습니다'
'net::ERR_CERT_AUTHORITY_INVALID' → 'SSL 인증서 오류'
'net::ERR_NAME_NOT_RESOLVED' → '도메인을 찾을 수 없습니다'
```

### 4. 프론트엔드 에러 표시 개선
- 에러 타입별로 다른 아이콘/색상 표시
- 해결 방법 제안 (URL 확인, 네트워크 점검 등)
- 재시도 버튼 추가

## 테스트 체크리스트 | Testing Checklist

- [x] 중복 결과 분석 스크립트 작성
- [x] API에서 중복 제거 로직 구현
- [x] 사용자 친화적 오류 메시지 매핑
- [ ] API 엔드포인트 테스트
- [ ] 프론트엔드에서 메시지 표시 확인
- [ ] 다른 Run ID로 테스트
- [ ] 데이터베이스 제약조건 추가 계획

## 날짜 | Date
2025-11-02

## 상태 | Status
🚧 **In Progress - API 수정 완료, 테스트 필요**
