# Epic 5: Alert & Notification System

## Overview

**목표**: Slack 기반 실시간 알림 시스템 구축

**설명**:
검증 실패(측정 ID 불일치, GTM ID 불일치, page_view 미발생) 발견 시 Slack Webhook을 통해 지정된 채널로 즉시 알림을 발송합니다. 알림에는 속성명, 이슈 유형, 검증 시간, 스크린샷 파일 경로가 포함되며, 치명적 오류 발생 시 긴급 알림을 발송합니다.

**연관 Requirements**: FR13, FR14, FR18, NFR2

**우선순위**: P0 (MVP 필수 기능)

**이유**: 실시간 알림은 이슈 발견 시간을 24시간 내로 단축하는 핵심 기능이며, 팀의 빠른 대응을 가능하게 합니다.

---

## User Stories

### User Story 5.1: Slack Webhook 알림 발송

**Story**: As a 디지털 애널리틱스 팀원, I want 검증 실패 시 Slack으로 알림을 받기를 원합니다, so that 이슈를 즉시 인지하고 대응할 수 있습니다.

**Acceptance Criteria**:
- [ ] Slack Webhook URL을 환경변수에서 로드한다
- [ ] 측정 ID 불일치 시 Slack 알림을 발송한다
- [ ] GTM ID 불일치 시 Slack 알림을 발송한다
- [ ] page_view 미발생 시 Slack 알림을 발송한다
- [ ] 알림은 즉시 발송되며, 배치 처리로 인한 지연이 없다
- [ ] Slack 발송 실패 시 에러 로그를 기록하지만 검증은 계속 진행한다

**Technical Notes**:
- 모듈: `resultStorage`
- 함수: `sendSlackAlert(result)`
- 환경변수: `SLACK_WEBHOOK_URL`
- HTTP 라이브러리: `node-fetch` ^3.3.0

**Implementation**:
```javascript
async function sendSlackAlert(result) {
  try {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;

    if (!webhookUrl) {
      console.error('SLACK_WEBHOOK_URL not configured');
      return;
    }

    // Only send alert if issues exist
    if (result.issues.length === 0) {
      return;
    }

    const message = formatSlackMessage(result);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message })
    });

    if (!response.ok) {
      console.error(`Slack alert failed: ${response.statusText}`);
    } else {
      console.log(`Slack alert sent for ${result.propertyName}`);
    }

  } catch (error) {
    console.error('Failed to send Slack alert:', error);
    // Don't fail validation, just log error
  }
}
```

---

### User Story 5.2: 알림 메시지 포맷팅

**Story**: As a 디지털 애널리틱스 팀원, I want Slack 알림에 필요한 정보가 포함되기를 원합니다, so that 알림만으로도 문제 상황을 파악할 수 있습니다.

**Acceptance Criteria**:
- [ ] 알림에 속성명을 포함한다
- [ ] 알림에 이슈 유형(측정 ID 불일치, GTM ID 불일치 등)을 포함한다
- [ ] 알림에 검증 시간을 포함한다
- [ ] 알림에 스크린샷 파일 경로를 포함한다
- [ ] 알림 메시지는 Slack Markdown 형식으로 포맷팅한다
- [ ] 치명적 오류 시 `@channel` 멘션을 포함하여 긴급 알림을 발송한다

**Technical Notes**:
- 함수: `formatSlackMessage(result)`
- Slack Markdown: `*bold*`, `_italic_`, `` `code` ``
- 이모지: 🚨 (critical), ⚠️ (warning), ℹ️ (info)

**Message Format**:
```javascript
function formatSlackMessage(result) {
  const issueEmoji = getIssueEmoji(result.issues);
  const issueType = result.issues.map(i => i.type).join(', ');

  let message = `${issueEmoji} *GA4 Tech Issue Detected*\n\n`;
  message += `*Property*: ${result.propertyName}\n`;
  message += `*Issue Type*: ${issueType}\n`;
  message += `*Timestamp*: ${new Date(result.validationTime).toLocaleString('ko-KR')}\n`;
  message += `*URL*: ${result.url}\n\n`;

  // Add issue details
  result.issues.forEach(issue => {
    message += `• ${issue.message}\n`;
    if (issue.expected && issue.actual) {
      message += `  Expected: \`${issue.expected}\`\n`;
      message += `  Actual: \`${issue.actual}\`\n`;
    }
  });

  message += `\n*Screenshot*: ${result.screenshotPath}\n`;

  // Add @channel for critical issues
  const hasCritical = result.issues.some(i => i.severity === 'critical');
  if (hasCritical) {
    message += `\n<!channel> Please investigate immediately.`;
  }

  return message;
}

function getIssueEmoji(issues) {
  const severities = issues.map(i => i.severity);
  if (severities.includes('critical')) return '🚨';
  if (severities.includes('warning')) return '⚠️';
  return 'ℹ️';
}
```

**Example Slack Message**:
```
🚨 *GA4 Tech Issue Detected*

*Property*: AMOREMALL KR
*Issue Type*: MEASUREMENT_ID_MISMATCH
*Timestamp*: 2025-01-15 오전 3:05:12
*URL*: https://www.amoremall.com

• Measurement ID mismatch
  Expected: `G-ABC1234567`
  Actual: `G-XYZ9876543`

*Screenshot*: screenshots/2025-01-15/amoremall-kr_20250115-030512.png

<!channel> Please investigate immediately.
```

---

## Implementation Plan

### Phase 1: Slack Webhook 연동
1. `resultStorage/sendSlackAlert()` 함수 구현
2. 환경변수에서 Webhook URL 로드
3. node-fetch로 POST 요청
4. 에러 처리

### Phase 2: 메시지 포맷팅
1. `formatSlackMessage()` 함수 구현
2. Slack Markdown 형식 적용
3. 이슈 상세 정보 포맷팅
4. 이모지 및 심각도 표시

### Phase 3: 조건부 알림
1. 이슈 존재 여부 확인
2. 심각도별 알림 로직
3. @channel 멘션 조건

---

## Testing

### Unit Tests
```javascript
describe('Slack Alert System', () => {
  it('should format Slack message correctly', () => {
    const result = {
      propertyName: 'Test Property',
      validationTime: new Date().toISOString(),
      url: 'https://example.com',
      issues: [
        {
          type: 'MEASUREMENT_ID_MISMATCH',
          severity: 'critical',
          message: 'Measurement ID mismatch',
          expected: 'G-ABC1234567',
          actual: 'G-XYZ9876543'
        }
      ],
      screenshotPath: 'screenshots/2025-01-15/test_20250115-030512.png'
    };

    const message = formatSlackMessage(result);

    expect(message).toContain('🚨');
    expect(message).toContain('Test Property');
    expect(message).toContain('MEASUREMENT_ID_MISMATCH');
    expect(message).toContain('G-ABC1234567');
    expect(message).toContain('<!channel>');
  });

  it('should skip alert if no issues', async () => {
    const result = {
      propertyName: 'Test Property',
      issues: []
    };

    // Mock fetch
    const fetchSpy = jest.spyOn(global, 'fetch');

    await sendSlackAlert(result);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('should handle Slack webhook failure gracefully', async () => {
    const result = {
      propertyName: 'Test Property',
      issues: [{ type: 'TEST_ISSUE', severity: 'warning', message: 'Test' }]
    };

    // Mock failed fetch
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      statusText: 'Bad Request'
    });

    // Should not throw error
    await expect(sendSlackAlert(result)).resolves.not.toThrow();
  });
});
```

### E2E Tests
```javascript
describe('Slack Alert E2E', () => {
  it('should send real Slack alert (manual verification)', async () => {
    const result = {
      propertyName: 'TEST PROPERTY (Manual Test)',
      validationTime: new Date().toISOString(),
      url: 'https://test.example.com',
      issues: [
        {
          type: 'TEST_ALERT',
          severity: 'info',
          message: 'This is a manual test alert',
          expected: 'test-expected',
          actual: 'test-actual'
        }
      ],
      screenshotPath: 'screenshots/test/manual-test.png'
    };

    await sendSlackAlert(result);

    // Manually verify alert received in Slack channel
    console.log('Manual verification: Check Slack channel for test alert');
  });
});
```

---

## Slack Channel Setup

### Channel Configuration
- **Channel Name**: `#ga4-tech-alerts` (권장)
- **Purpose**: GA4/GTM 설정 이슈 자동 알림
- **Members**: 디지털 애널리틱스 팀 (3명)
- **Notification Level**: All messages (모든 메시지 알림)

### Webhook Setup
1. Slack 워크스페이스에서 Incoming Webhooks 앱 추가
2. `#ga4-tech-alerts` 채널 선택
3. Webhook URL 생성
4. `.env` 파일에 URL 추가: `SLACK_WEBHOOK_URL=https://hooks.slack.com/services/XXX/YYY/ZZZ`

---

## Dependencies

### Modules
- `resultStorage`: 알림 발송 로직 포함

### External Libraries
- `node-fetch`: ^3.3.0 - HTTP POST 요청

### External Services
- Slack Incoming Webhooks API

### Related Architecture
- Slack Integration (architecture.md 참조)

---

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Slack Webhook 장애 | Medium | 에러 로그 기록, 검증 계속 진행, JSON 결과 보존 |
| Webhook URL 노출 | High | 환경변수 관리, .gitignore 추가, 팀 전용 접근 |
| 알림 과다 (Spam) | Low | 이슈 발생 시에만 발송, 중복 방지 로직 |
| @channel 남용 | Low | Critical severity에만 사용 |

---

## Success Metrics

- [ ] 알림 발송 성공률 > 99%
- [ ] 알림 발송 지연 < 5초
- [ ] False positive rate < 5% (불필요한 알림)
- [ ] 알림 메시지 정확도 100% (모든 필수 정보 포함)

---

**Epic Status**: 🚫 Not Implemented (Intentionally Excluded)
**Assigned To**: N/A
**Decision Date**: 2025-10-30
**Target Sprint**: Sprint 2 (Week 3-4)
**Stories**: 2/2 (5.1, 5.2 - Status: Approved, Not Implemented)
**Reason**: Slack integration excluded from MVP scope per product decision
**Alternative**: Manual monitoring via web dashboard and JSON reports
