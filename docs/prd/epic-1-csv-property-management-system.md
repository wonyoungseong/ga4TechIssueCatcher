# Epic 1: CSV Property Management System

## Overview

**목표**: CSV 파일 기반 속성 관리 시스템 구축

**설명**:
Amorepacific의 100개 이상 디지털 속성 메타데이터를 CSV 파일로 관리하고, 자동으로 로드/파싱하여 검증 대상을 동적으로 업데이트하는 시스템을 구현합니다. 이는 별도의 코드 수정이나 재배포 없이 CSV 파일 수정만으로 속성 추가/제거를 가능하게 합니다.

**연관 Requirements**: FR1, FR2, NFR9, NFR10, NFR11

**우선순위**: P0 (MVP 필수 기능)

**이유**: CSV 기반 속성 관리는 시스템의 핵심 입력 데이터 소스이며, 모든 검증 작업의 기반이 됩니다.

---

## User Stories

### User Story 1.1: CSV 파일 로드 및 파싱

**Story**: As a 디지털 애널리틱스 팀원, I want CSV 파일에서 속성 메타데이터를 자동으로 로드하고 파싱하기를 원합니다, so that 코드 수정 없이 검증 대상 속성을 관리할 수 있습니다.

**Acceptance Criteria**:
- [ ] 시스템은 `src/ga4Property/Amore_GA4_PropertList.csv` 파일을 읽을 수 있다
- [ ] CSV 파일이 존재하지 않으면 명확한 에러 메시지를 출력한다
- [ ] CSV 파일의 인코딩은 UTF-8을 지원한다
- [ ] CSV 헤더 행을 올바르게 파싱하여 컬럼명을 식별한다
- [ ] 빈 행이나 주석 행(#으로 시작)을 무시한다

**Technical Notes**:
- 모듈: `propertyUrlResolver`
- 라이브러리: `csv-parser` ^3.0.0
- 에러 처리: CSV 파일 없음 → 치명적 오류, 프로세스 종료

---

### User Story 1.2: 속성 메타데이터 추출

**Story**: As a 디지털 애널리틱스 팀원, I want CSV에서 각 속성의 측정 ID, GTM ID, URL, whitelist를 추출하기를 원합니다, so that 검증에 필요한 모든 정보를 사용할 수 있습니다.

**Acceptance Criteria**:
- [ ] 각 속성의 측정 ID(G-XXXXXXXXX)를 추출한다
- [ ] 각 속성의 GTM 컨테이너 ID(GTM-XXXXXXXX)를 추출한다
- [ ] 각 속성의 대표 URL을 추출한다
- [ ] Whitelist 도메인 목록을 추출하여 배열로 저장한다
- [ ] 필수 필드(측정 ID, URL)가 누락된 행은 경고 로그를 출력하고 건너뛴다

**Technical Notes**:
- 데이터 모델: `Property` 객체
- 컬럼 매핑: `csvColumnNames` 모듈의 COLUMN_NAMES 상수 사용
- 검증 함수: `validatePropertyMetadata(property)`

**Data Model**:
```typescript
interface Property {
  accountName: string;          // 계정명
  propertyName: string;         // 속성명
  measurementId: string;        // GA4 측정 ID
  siteType: string;             // 사이트 유형
  representativeUrl: string;    // 대표 URL
  webAppType: string;           // 웹/앱 여부
  webGtmId: string;             // Web GTM ID
  androidGtmId?: string;        // Android GTM ID (optional)
  iosGtmId?: string;            // iOS GTM ID (optional)
  datasetId?: string;           // Dataset ID (optional)
  marketingGtm?: string;        // 마케팅 GTM (optional)
  whitelist?: string[];         // Whitelist 도메인 배열 (optional)
}
```

---

### User Story 1.3: CSV 업데이트 감지

**Story**: As a 디지털 애널리틱스 팀원, I want CSV 파일이 업데이트되면 자동으로 새로운 속성을 감지하기를 원합니다, so that 재배포 없이 속성을 추가/제거할 수 있습니다.

**Acceptance Criteria**:
- [ ] 매 실행 시 CSV 파일을 새로 읽어서 최신 데이터를 사용한다
- [ ] 이전 실행 대비 추가된 속성을 로그에 기록한다
- [ ] 이전 실행 대비 제거된 속성을 로그에 기록한다
- [ ] CSV 파일 수정 후 다음 실행 시 변경사항이 즉시 반영된다

**Technical Notes**:
- 함수: `detectPropertyChanges(oldProperties, newProperties)`
- 로깅: winston logger 사용, INFO 레벨
- 비교 키: `measurementId` 기준으로 속성 식별

---

## Implementation Plan

### Phase 1: CSV 파싱 기본 기능
1. `propertyUrlResolver/loadProperties()` 함수 구현
2. CSV 파일 읽기 및 UTF-8 인코딩 처리
3. csv-parser로 데이터 파싱
4. Property 객체 배열 반환

### Phase 2: 메타데이터 검증
1. `validatePropertyMetadata()` 함수 구현
2. 필수 필드 존재 확인 (measurementId, representativeUrl)
3. 측정 ID 형식 검증 (정규식: `G-[A-Z0-9]{10}`)
4. GTM ID 형식 검증 (정규식: `GTM-[A-Z0-9]{6,}`)
5. URL 형식 검증

### Phase 3: 변경 감지
1. `detectPropertyChanges()` 함수 구현
2. 이전 속성 목록 메모리 저장
3. 새 속성 목록과 비교 (measurementId 기준)
4. 추가/제거된 속성 로그 기록

---

## Testing

### Unit Tests
```javascript
describe('propertyUrlResolver', () => {
  it('should load properties from CSV file', async () => {
    const properties = await loadProperties('test/fixtures/test-properties.csv');
    expect(properties).toHaveLength(3);
  });

  it('should throw error if CSV file does not exist', async () => {
    await expect(loadProperties('nonexistent.csv')).rejects.toThrow();
  });

  it('should validate property metadata correctly', () => {
    const validProperty = {
      measurementId: 'G-ABC1234567',
      representativeUrl: 'https://example.com',
      // ... other fields
    };
    const result = validatePropertyMetadata(validProperty);
    expect(result.isValid).toBe(true);
  });

  it('should reject invalid measurement ID format', () => {
    const invalidProperty = {
      measurementId: 'INVALID-ID',
      representativeUrl: 'https://example.com',
    };
    const result = validatePropertyMetadata(invalidProperty);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Invalid measurement ID format');
  });

  it('should detect added properties', () => {
    const oldProperties = [
      { measurementId: 'G-ABC1234567', /* ... */ },
    ];
    const newProperties = [
      { measurementId: 'G-ABC1234567', /* ... */ },
      { measurementId: 'G-XYZ9876543', /* ... */ },
    ];
    const changes = detectPropertyChanges(oldProperties, newProperties);
    expect(changes.added).toHaveLength(1);
    expect(changes.added[0].measurementId).toBe('G-XYZ9876543');
  });
});
```

---

## Dependencies

### Modules
- `csvColumnNames`: CSV 컬럼명 상수 정의

### External Libraries
- `csv-parser`: ^3.0.0 - CSV 파싱
- `fs/promises`: Node.js built-in - 파일 시스템 접근

### Related Architecture
- Data Model: `Property` 인터페이스 (architecture.md 참조)
- API: `propertyUrlResolver` 모듈 (architecture.md 참조)

---

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| CSV 파일 형식 변경 | High | csvColumnNames 모듈로 컬럼명 중앙 관리, 하위 호환성 유지 |
| 인코딩 문제 (한글 깨짐) | Medium | UTF-8 명시적 지정, BOM 처리 |
| 대용량 CSV 성능 | Low | 현재 100개 속성으로 문제 없음, 향후 스트리밍 파싱 고려 |
| 필수 필드 누락 | Medium | 검증 로직 강화, 명확한 에러 메시지 |

---

## Success Metrics

- [ ] 100개 속성 CSV 파일을 1초 내 로드 및 파싱
- [ ] 필수 필드 누락 시 명확한 에러 메시지 출력
- [ ] 속성 추가/제거 시 로그에 정확하게 기록
- [ ] CSV 파일 수정 후 다음 실행 시 변경사항 즉시 반영

---

**Epic Status**: ✅ Completed
**Assigned To**: James (Dev Agent)
**Completion Date**: 2025-10-30
**Target Sprint**: Sprint 1 (Week 1-2)
**Stories Completed**: 3/3 (1.1, 1.2, 1.3 - All Done)
**QA Status**: All stories have QA gates with PASS status
