# Epic 7: Logging & Monitoring

## Overview

**목표**: 시스템 실행 로깅 및 모니터링 구축

**설명**:
전체 검증 실행의 시작 시간, 종료 시간, 처리된 속성 수, 성공/실패 건수를 로그 파일에 기록합니다. 실행 중 치명적 오류 발생 시 로그에 상세 에러 메시지를 기록하여 트러블슈팅을 지원합니다.

**연관 Requirements**: FR17, FR18, NFR2, NFR12

**우선순위**: P1 (중요 기능)

**이유**: 로깅은 시스템 운영 및 트러블슈팅에 중요하지만, MVP의 핵심 검증 기능은 아닙니다.

---

## User Stories

### User Story 7.1: 실행 로그 기록

**Story**: As a 시스템 관리자, I want 시스템 실행의 모든 주요 이벤트를 로그에 기록하기를 원합니다, so that 트러블슈팅하고 시스템 운영 상태를 모니터링할 수 있습니다.

**Acceptance Criteria**:
- [ ] 전체 검증 실행의 시작 시간을 로그에 기록한다
- [ ] 전체 검증 실행의 종료 시간을 로그에 기록한다
- [ ] 처리된 속성 수, 성공 건수, 실패 건수를 로그에 기록한다
- [ ] 각 속성의 검증 시작/종료를 로그에 기록한다
- [ ] 치명적 오류(서버 다운, CSV 파일 없음 등) 발생 시 상세 에러 메시지를 로그에 기록한다
- [ ] 로그 파일은 날짜별로 로테이션된다(`logs/YYYY-MM-DD.log`)
- [ ] 로그 레벨(INFO, WARN, ERROR)을 구분하여 기록한다

**Technical Notes**:
- 라이브러리: `winston` ^3.11.0
- 로그 레벨: ERROR (0) > WARN (1) > INFO (2) > DEBUG (3)
- 로그 포맷: JSON (파싱 용이) 또는 Plain text (가독성)
- 로그 파일 경로: `logs/YYYY-MM-DD.log`
- 환경변수: `LOG_LEVEL` (기본값: info)

**Winston Configuration**:
```javascript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'ga4-tech-issue-catcher' },
  transports: [
    // File transport - Daily rotation
    new winston.transports.File({
      filename: `logs/${new Date().toISOString().split('T')[0]}.log`,
      level: 'info'
    }),
    // Console transport (for development)
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

export default logger;
```

**Logging Usage**:
```javascript
// Main execution start
logger.info('GA4 Tech Issue Catcher started', {
  totalProperties: properties.length,
  browserPoolSize: 5
});

// Property validation start
logger.info('Validating property', {
  propertyName: property.propertyName,
  url: property.representativeUrl
});

// Property validation end
logger.info('Property validation completed', {
  propertyName: property.propertyName,
  isValid: result.issues.length === 0,
  issueCount: result.issues.length,
  executionTimeMs: result.executionTimeMs
});

// Fatal error
logger.error('Fatal error: CSV file not found', {
  csvPath: CSV_PATH,
  error: error.message,
  stack: error.stack
});

// Main execution end
logger.info('GA4 Tech Issue Catcher completed', {
  totalProperties: properties.length,
  successCount: results.filter(r => r.issues.length === 0).length,
  failureCount: results.filter(r => r.issues.length > 0).length,
  executionTimeMs: Date.now() - startTime
});
```

---

## Log Structure

### Log Levels

**ERROR** (Level 0):
- 치명적 오류 (CSV 파일 없음, 브라우저 초기화 실패)
- 복구 불가능한 에러
- 즉각적인 조치 필요

**WARN** (Level 1):
- 경고 (스크린샷 캡처 실패, Slack 알림 실패)
- 시스템 계속 실행 가능
- 모니터링 필요

**INFO** (Level 2):
- 일반 정보 (실행 시작/종료, 속성 검증 완료)
- 정상 동작 기록
- 운영 모니터링

**DEBUG** (Level 3):
- 상세 디버깅 정보 (네트워크 이벤트, 파라미터 값)
- 개발/디버깅 용도
- 프로덕션에서는 비활성화

### Log Entry Format

**JSON Format** (파싱 용이):
```json
{
  "level": "info",
  "message": "Property validation completed",
  "timestamp": "2025-01-15 03:05:12",
  "service": "ga4-tech-issue-catcher",
  "propertyName": "AMOREMALL KR",
  "isValid": false,
  "issueCount": 1,
  "executionTimeMs": 5432
}
```

**Plain Text Format** (가독성):
```
2025-01-15 03:05:12 [INFO] Property validation completed - AMOREMALL KR (isValid: false, issueCount: 1, executionTimeMs: 5432ms)
```

---

## Log Rotation

### Daily Rotation
- 로그 파일명: `logs/YYYY-MM-DD.log`
- 매일 새로운 로그 파일 생성
- 이전 로그 파일 보존

### Cleanup Policy
- 30일 이상 경과한 로그 파일 자동 삭제
- 스토리지 관리 (results/screenshots와 동일)

**Log Cleanup**:
```javascript
async function cleanupOldLogs(retentionDays = 30) {
  try {
    const logFiles = await fs.promises.readdir('logs');
    const today = new Date();
    const cutoffDate = new Date(today);
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    let deletedCount = 0;

    for (const file of logFiles) {
      if (!file.endsWith('.log')) continue;

      // Parse date from filename (YYYY-MM-DD.log)
      const dateStr = file.replace('.log', '');
      const fileDate = new Date(dateStr);

      if (isNaN(fileDate.getTime())) continue;

      if (fileDate < cutoffDate) {
        await fs.promises.unlink(`logs/${file}`);
        deletedCount++;
        console.log(`Deleted old log file: ${file}`);
      }
    }

    console.log(`Log cleanup completed: ${deletedCount} files deleted`);

  } catch (error) {
    console.error('Failed to cleanup old logs:', error);
  }
}
```

---

## Monitoring Metrics

### Execution Metrics
```javascript
// Calculate and log execution summary
const executionSummary = {
  startTime: startTime,
  endTime: endTime,
  totalProperties: properties.length,
  successCount: results.filter(r => r.issues.length === 0).length,
  failureCount: results.filter(r => r.issues.length > 0).length,
  averageExecutionTimeMs: results.reduce((sum, r) => sum + r.executionTimeMs, 0) / results.length,
  totalExecutionTimeMs: endTime - startTime
};

logger.info('Execution summary', executionSummary);
```

### Health Metrics
- 실행 성공률: `successCount / totalProperties`
- 평균 검증 시간: `averageExecutionTimeMs`
- 재시도 비율: `retryCount / totalProperties`
- False positive rate: 수동 검증 필요

---

## Implementation Plan

### Phase 1: Winston 설정
1. winston 라이브러리 설치
2. Logger 설정 파일 생성 (`src/utils/logger.js`)
3. 로그 레벨, 포맷, Transport 설정
4. 환경변수 연동

### Phase 2: 로깅 통합
1. orchestrator에 로깅 추가 (시작/종료)
2. 각 모듈에 로깅 추가 (validateProperty, saveResult, etc.)
3. 에러 핸들링에 로깅 추가
4. 실행 요약 로그 생성

### Phase 3: 로그 관리
1. 날짜별 로그 파일 생성
2. 로그 로테이션 자동화
3. 30일 경과 로그 자동 삭제

---

## Testing

### Unit Tests
```javascript
describe('Logger', () => {
  it('should create daily log file', () => {
    const today = new Date().toISOString().split('T')[0];
    const logFile = `logs/${today}.log`;

    logger.info('Test log entry');

    expect(fs.existsSync(logFile)).toBe(true);
  });

  it('should log with correct level', () => {
    const logSpy = jest.spyOn(logger, 'info');

    logger.info('Test message', { key: 'value' });

    expect(logSpy).toHaveBeenCalledWith('Test message', { key: 'value' });
  });

  it('should include stack trace for errors', () => {
    const error = new Error('Test error');
    logger.error('Error occurred', { error });

    // Check log file contains stack trace
    const logContent = fs.readFileSync(`logs/${new Date().toISOString().split('T')[0]}.log`, 'utf-8');
    expect(logContent).toContain('stack');
  });
});

describe('Log Cleanup', () => {
  it('should delete logs older than 30 days', async () => {
    // Create old log file
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 35);
    const oldLogFile = `logs/${oldDate.toISOString().split('T')[0]}.log`;
    await fs.promises.writeFile(oldLogFile, 'old log');

    await cleanupOldLogs(30);

    expect(fs.existsSync(oldLogFile)).toBe(false);
  });
});
```

---

## Log Analysis

### Useful Queries

**Find all errors**:
```bash
grep '"level":"error"' logs/2025-01-15.log
```

**Find validation failures**:
```bash
grep '"isValid":false' logs/2025-01-15.log
```

**Count successful vs failed validations**:
```bash
grep -c '"isValid":true' logs/2025-01-15.log
grep -c '"isValid":false' logs/2025-01-15.log
```

**Calculate average execution time**:
```bash
grep '"executionTimeMs"' logs/2025-01-15.log | jq '.executionTimeMs' | awk '{sum+=$1} END {print sum/NR}'
```

---

## Dependencies

### External Libraries
- `winston`: ^3.11.0 - 로깅 라이브러리

### Related Architecture
- Logging (architecture.md 참조)

---

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| 로그 파일 과다 증가 | Low | 30일 자동 삭제, JSON 포맷 (압축 가능) |
| 디스크 I/O 부하 | Low | 비동기 로깅, 버퍼링 |
| 민감 정보 로그 노출 | Medium | 로그 레벨 조정, 권한 설정 |

---

## Success Metrics

- [ ] 100% 주요 이벤트 로그 기록 (시작/종료, 검증 완료)
- [ ] 로그 파일 자동 로테이션 100% 성공률
- [ ] 30일 경과 로그 자동 삭제 100% 성공률
- [ ] 로그 기반 트러블슈팅 가능 (에러 원인 파악)

---

**Epic Status**: ✅ Completed
**Assigned To**: James (Dev Agent)
**Completion Date**: 2025-10-30
**Target Sprint**: Sprint 3 (Week 5-6)
**Stories Completed**: 1/1 (7.1 - Done)
**QA Status**: QA gate PASS (100/100) - Winston logger with daily rotation, multiple log levels, comprehensive test coverage
