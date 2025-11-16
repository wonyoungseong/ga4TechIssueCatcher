# Epic 4: Result Storage & Screenshot Management

## Overview

**목표**: 검증 결과 저장 및 스크린샷 관리 시스템 구축

**설명**:
각 속성의 검증 결과를 JSON 형식으로 저장하고, fullPage 스크린샷을 날짜별 폴더 구조(YYYY-MM-DD)로 저장합니다. 30일 이상 경과한 데이터를 자동으로 삭제하여 스토리지를 효율적으로 관리하며, 증거 기반 트러블슈팅을 지원합니다.

**연관 Requirements**: FR10, FR11, FR12, NFR7

**우선순위**: P1 (중요 기능)

**이유**: 검증 증거 저장은 히스토리 추적 및 트러블슈팅에 중요하지만, 시스템의 핵심 검증 기능은 아닙니다.

---

## User Stories

### User Story 4.1: 검증 결과 JSON 저장

**Story**: As a 디지털 애널리틱스 팀원, I want 각 속성의 검증 결과를 JSON 형식으로 저장하기를 원합니다, so that 히스토리를 추적하고 트러블슈팅할 수 있습니다.

**Acceptance Criteria**:
- [ ] JSON 파일에 속성명, 검증 시간, 측정 ID 일치 여부를 저장한다
- [ ] JSON 파일에 GTM ID 일치 여부, page_view 발생 여부를 저장한다
- [ ] JSON 파일에 발견된 이슈 목록(배열)을 저장한다
- [ ] JSON 파일에 스크린샷 파일 경로를 저장한다
- [ ] JSON 파일은 날짜별 폴더에 저장된다(`results/YYYY-MM-DD/property-name.json`)
- [ ] JSON은 읽기 쉽도록 들여쓰기(pretty print)된다

**Technical Notes**:
- 모듈: `resultStorage`
- 함수: `saveValidationResult(result, date)`
- 경로 패턴: `results/YYYY-MM-DD/property-name.json`
- JSON 포맷: `JSON.stringify(result, null, 2)` (2 spaces indentation)

**JSON Structure**:
```json
{
  "propertyName": "AMOREMALL KR",
  "validationTime": "2025-01-15T03:05:12.000Z",
  "url": "https://www.amoremall.com",
  "measurementId": {
    "expected": "G-ABC1234567",
    "actual": "G-ABC1234567",
    "isValid": true
  },
  "gtmId": {
    "expected": "GTM-XXXXXXXX",
    "actual": "GTM-XXXXXXXX",
    "isValid": true
  },
  "pageViewEvent": {
    "isValid": true,
    "count": 1
  },
  "apData": {
    "brand": "AMOREMALL",
    "country": "KR"
  },
  "issues": [],
  "screenshotPath": "screenshots/2025-01-15/amoremall-kr_20250115-030512.png",
  "retryCount": 0,
  "executionTimeMs": 5432
}
```

---

### User Story 4.2: fullPage 스크린샷 캡처

**Story**: As a 디지털 애널리틱스 팀원, I want 각 속성의 fullPage 스크린샷을 캡처하기를 원합니다, so that 시각적 증거를 확보하고 문제 상황을 확인할 수 있습니다.

**Acceptance Criteria**:
- [ ] 검증 후 Playwright의 `screenshot({ fullPage: true })`를 사용한다
- [ ] 스크린샷 파일명에 속성명과 타임스탬프를 포함한다(`property-name_YYYYMMDD-HHmmss.png`)
- [ ] 스크린샷은 날짜별 폴더에 저장된다(`screenshots/YYYY-MM-DD/`)
- [ ] 스크린샷 캡처 실패 시 에러 로그를 기록하지만 검증은 계속 진행한다
- [ ] 스크린샷 파일 크기가 10MB를 초과하면 경고 로그를 출력한다

**Technical Notes**:
- 모듈: `resultStorage`
- 함수: `saveScreenshot(page, propertyName, date)`
- Playwright API: `page.screenshot({ fullPage: true, path: '...' })`
- 파일명 포맷: `propertyName_YYYYMMDD-HHmmss.png`

**Implementation**:
```javascript
async function saveScreenshot(page, propertyName, date) {
  try {
    // Create date folder
    const dateFolder = `screenshots/${date}`;
    await fs.promises.mkdir(dateFolder, { recursive: true });

    // Generate filename with timestamp
    const timestamp = new Date().toISOString()
      .replace(/[-:]/g, '')
      .replace('T', '-')
      .split('.')[0]; // YYYYMMDDHHmmss
    const filename = `${propertyName}_${timestamp}.png`;
    const filePath = `${dateFolder}/${filename}`;

    // Capture fullPage screenshot
    await page.screenshot({
      fullPage: true,
      path: filePath
    });

    // Check file size
    const stats = await fs.promises.stat(filePath);
    const fileSizeMB = stats.size / (1024 * 1024);
    if (fileSizeMB > 10) {
      console.warn(`Screenshot file size exceeds 10MB: ${fileSizeMB.toFixed(2)}MB`);
    }

    return filePath;

  } catch (error) {
    console.error('Failed to save screenshot:', error);
    return null; // Don't fail validation, just log error
  }
}
```

---

### User Story 4.3: 30일 경과 데이터 삭제

**Story**: As a 시스템 관리자, I want 30일 이상 경과한 스크린샷과 JSON 결과를 자동으로 삭제하기를 원합니다, so that 스토리지를 효율적으로 관리할 수 있습니다.

**Acceptance Criteria**:
- [ ] 매 실행 시작 시 30일 이상 경과한 폴더를 검색한다
- [ ] 해당 폴더의 모든 파일을 삭제한다
- [ ] 삭제된 폴더 개수와 파일 개수를 로그에 기록한다
- [ ] 삭제 실패 시 에러 로그를 기록하지만 검증은 계속 진행한다
- [ ] 현재 날짜 폴더는 30일 경과 여부와 무관하게 삭제하지 않는다

**Technical Notes**:
- 모듈: `resultStorage`
- 함수: `cleanupOldFiles(basePath, retentionDays)`
- 기본 보존 기간: 30일 (환경변수 `RETENTION_DAYS`)
- 삭제 대상: `results/` 및 `screenshots/` 폴더

**Implementation**:
```javascript
async function cleanupOldFiles(basePath, retentionDays = 30) {
  try {
    const folders = await fs.promises.readdir(basePath);
    const today = new Date();
    const cutoffDate = new Date(today);
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    let deletedFolders = 0;
    let deletedFiles = 0;

    for (const folder of folders) {
      // Parse folder name as date (YYYY-MM-DD)
      const folderPath = `${basePath}/${folder}`;
      const folderDate = new Date(folder);

      // Skip if not a valid date folder
      if (isNaN(folderDate.getTime())) {
        continue;
      }

      // Delete if older than retention period
      if (folderDate < cutoffDate) {
        const files = await fs.promises.readdir(folderPath);
        deletedFiles += files.length;

        await fs.promises.rm(folderPath, { recursive: true });
        deletedFolders++;

        console.log(`Deleted old folder: ${folder} (${files.length} files)`);
      }
    }

    console.log(`Cleanup completed: ${deletedFolders} folders, ${deletedFiles} files deleted`);
    return { deletedFolders, deletedFiles };

  } catch (error) {
    console.error('Failed to cleanup old files:', error);
    return { deletedFolders: 0, deletedFiles: 0 };
  }
}
```

---

## Folder Structure

```
ga4TechIssueCatcher/
├── results/
│   ├── 2025-01-15/
│   │   ├── amoremall-kr.json
│   │   ├── innisfree-us.json
│   │   ├── laneige-jp.json
│   │   └── ...
│   ├── 2025-01-16/
│   ├── 2025-01-17/
│   └── ...
├── screenshots/
│   ├── 2025-01-15/
│   │   ├── amoremall-kr_20250115-030512.png
│   │   ├── innisfree-us_20250115-030845.png
│   │   ├── laneige-jp_20250115-031203.png
│   │   └── ...
│   ├── 2025-01-16/
│   ├── 2025-01-17/
│   └── ...
└── logs/
    ├── 2025-01-15.log
    ├── 2025-01-16.log
    └── ...
```

---

## Implementation Plan

### Phase 1: JSON 저장
1. `resultStorage/saveValidationResult()` 함수 구현
2. 날짜별 폴더 생성 (YYYY-MM-DD)
3. ValidationResult 객체를 JSON 문자열로 변환
4. 파일 쓰기 (pretty print)

### Phase 2: 스크린샷 캡처
1. `resultStorage/saveScreenshot()` 함수 구현
2. Playwright screenshot API 사용
3. 파일명 생성 (타임스탬프 포함)
4. 파일 크기 체크

### Phase 3: 자동 삭제
1. `resultStorage/cleanupOldFiles()` 함수 구현
2. 날짜 폴더 검색 및 파싱
3. 30일 경과 판단
4. 폴더 삭제 (재귀적)

---

## Testing

### Unit Tests
```javascript
describe('resultStorage', () => {
  it('should save validation result as JSON', async () => {
    const result = {
      propertyName: 'Test Property',
      validationTime: new Date().toISOString(),
      measurementId: { isValid: true },
      issues: []
    };
    const filePath = await saveValidationResult(result, '2025-01-15');
    expect(fs.existsSync(filePath)).toBe(true);

    const savedContent = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(savedContent);
    expect(parsed.propertyName).toBe('Test Property');
  });

  it('should save screenshot with correct filename', async () => {
    const page = await browser.newPage();
    await page.setContent('<html><body>Test</body></html>');

    const filePath = await saveScreenshot(page, 'test-property', '2025-01-15');
    expect(filePath).toMatch(/screenshots\/2025-01-15\/test-property_\d{8}-\d{6}\.png/);
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('should cleanup files older than 30 days', async () => {
    // Create test folders
    const oldFolder = 'results/2024-12-01';
    const recentFolder = 'results/2025-01-15';
    await fs.promises.mkdir(oldFolder, { recursive: true });
    await fs.promises.mkdir(recentFolder, { recursive: true });
    await fs.promises.writeFile(`${oldFolder}/test.json`, '{}');
    await fs.promises.writeFile(`${recentFolder}/test.json`, '{}');

    const result = await cleanupOldFiles('results', 30);

    expect(fs.existsSync(oldFolder)).toBe(false);
    expect(fs.existsSync(recentFolder)).toBe(true);
    expect(result.deletedFolders).toBe(1);
  });
});
```

---

## Storage Estimates

### Capacity Planning
- 스크린샷 크기: 평균 2MB per property
- JSON 결과 크기: 평균 10KB per property
- 100 properties × 2MB = 200MB per day (screenshots)
- 100 properties × 10KB = 1MB per day (JSON results)
- 30일 보존: 200MB × 30 = 6GB (screenshots) + 30MB (JSON) ≈ 6.03GB total

### Server Capacity
- 최소 스토리지: 100GB (충분한 여유 공간)
- 사용 예상: ~6GB (30일 데이터)
- 여유 공간: ~94GB

---

## Dependencies

### Modules
- `configValidator`: ValidationResult 객체 생성

### External Libraries
- `fs/promises`: Node.js built-in - 파일 시스템
- `playwright`: ^1.40.0 - 스크린샷 캡처

### Related Architecture
- Data Model: `ValidationResult` (architecture.md 참조)
- Deployment: 폴더 구조 및 권한 설정 (architecture.md 참조)

---

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| 스토리지 부족 | Medium | 30일 자동 삭제, 서버 용량 모니터링 |
| 대용량 스크린샷 (>10MB) | Low | 경고 로그 출력, 압축 고려 |
| 파일 쓰기 실패 (권한) | Medium | 폴더 권한 체크, 에러 처리 |
| 날짜 폴더 파싱 오류 | Low | 정규식 검증, try-catch |

---

## Success Metrics

- [ ] 100% 검증 결과 JSON 저장 성공률
- [ ] 95% 이상 스크린샷 캡처 성공률
- [ ] 30일 경과 데이터 자동 삭제 100% 성공률
- [ ] 스토리지 사용량 < 10GB (30일 데이터)

---

**Epic Status**: ✅ Completed
**Assigned To**: James (Dev Agent)
**Completion Date**: 2025-10-30
**Target Sprint**: Sprint 3 (Week 5-6)
**Stories Completed**: 3/3 (4.1, 4.2, 4.3 - All Done)
**QA Status**: All stories implemented with comprehensive test coverage
