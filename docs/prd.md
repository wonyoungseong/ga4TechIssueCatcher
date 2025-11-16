# GA4 Tech Issue Catcher Product Requirements Document (PRD)

## Goals and Background Context

### Goals

- 100개 이상 Amorepacific 디지털 속성의 GA4/GTM 설정을 매일 자동 검증
- 데이터 손실 방지를 통해 연간 $200K 상당의 비즈니스 영향 방어
- 디지털 애널리틱스 팀의 수동 검증 시간을 주 15시간에서 3시간으로 80% 절감
- 이슈 발견 시간을 현재 2-4주에서 24시간 이내로 단축
- 증거 기반 검증을 통한 히스토리 추적 및 트러블슈팅 지원

### Background Context

Amorepacific은 한국, 미국, 일본, 중국, 동남아시아 등 전 세계에 걸쳐 100개 이상의 디지털 속성(이커머스, 브랜드 사이트, D2C 플랫폼, 내부 시스템)을 운영하고 있습니다. 각 속성은 GA4 측정 ID와 GTM 컨테이너를 통해 사용자 행동과 비즈니스 메트릭을 추적하지만, 지속적인 배포, A/B 테스트, 다국가 출시로 인해 주간 5-10개 속성에서 설정 변경이 발생합니다.

현재 디지털 애널리틱스 팀(3명)은 수동으로 속성을 검증하고 있으며, 연간 800시간을 소비하고 있습니다. 그러나 수동 검증의 한계로 문제 발견까지 평균 2-4주가 소요되며, 최근 LANEIGE US에서 3주간 데이터 미수집으로 $50K 상당의 광고 비용 추적이 불가능한 사례가 발생했습니다. 상용 모니터링 도구(ObservePoint 등)는 연간 $25K 이상의 비용이 들며, 내부 속성 접근 제한과 CSV 기반 워크플로우 미통합 문제로 인해 적합하지 않습니다.

기존 개념 증명(PoC) 시스템이 `/Users/seong-won-yeong/Documents/Project/ga4IssueCatcher/`에 존재하며, 10개 속성 대상 테스트를 성공적으로 완료했습니다. 이 PRD는 PoC를 프로덕션 시스템으로 전환하고 100개 전체 속성으로 확장하는 것을 목표로 합니다.

### Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2025-10-29 | 1.0 | 초기 PRD 작성 | Mary (Business Analyst) |

---

## Requirements

### Functional Requirements

**FR1**: 시스템은 CSV 파일(`src/ga4Property/Amore_GA4_PropertList.csv`)에서 속성 메타데이터를 자동으로 로드하고 파싱해야 한다. 메타데이터에는 측정 ID(G-XXXXXXXXX), GTM 컨테이너 ID(GTM-XXXXXXXX), 대표 URL, whitelist 도메인이 포함된다.

**FR2**: 시스템은 CSV 파일이 업데이트되면 다음 실행 시 자동으로 새로운 속성을 감지하고 검증 대상에 추가해야 한다. 별도의 설정 변경이나 재배포 없이 CSV 업데이트만으로 속성 추가/제거가 가능해야 한다.

**FR3**: 시스템은 cron job을 통해 매일 새벽 3시에 자동으로 실행되어야 한다. 수동 트리거 없이 완전 자동화된 일일 검증을 수행해야 한다.

**FR4**: 시스템은 Playwright를 사용하여 Chromium 브라우저 5개를 병렬로 실행하고, 각 브라우저가 할당된 속성을 순차적으로 방문하여 검증해야 한다. 브라우저 풀 관리(acquireBrowser, releaseBrowser)를 통해 리소스를 효율적으로 사용해야 한다.

**FR5**: 시스템은 Chrome DevTools Protocol(CDP)을 사용하여 각 속성 방문 시 네트워크 요청을 감청하고, `analytics.google.com/g/collect` 패턴의 GA4 이벤트를 캡처해야 한다.

**FR6**: 시스템은 캡처된 GA4 이벤트에서 측정 ID를 추출하고, CSV 파일의 기대값과 비교하여 일치 여부를 검증해야 한다. 불일치 시 이슈로 기록해야 한다.

**FR7**: 시스템은 페이지의 GTM 스크립트를 감지하고, GTM 컨테이너 ID를 추출하여 CSV 파일의 기대값과 비교 검증해야 한다. 불일치 시 이슈로 기록해야 한다.

**FR8**: 시스템은 각 속성에서 `page_view` 이벤트가 정상적으로 발생하는지 확인해야 한다. 이벤트 미발생 시 이슈로 기록해야 한다.

**FR9**: 시스템은 페이지의 전역 변수 또는 data layer에서 `AP_DATA` 환경변수를 추출하여 Amorepacific 특화 설정을 검증해야 한다.

**FR10**: 시스템은 각 속성 검증 후 fullPage 스크린샷을 캡처하고, 날짜별 폴더 구조(`YYYY-MM-DD`)로 저장해야 한다. 스크린샷 파일명에는 속성명과 타임스탬프가 포함되어야 한다.

**FR11**: 시스템은 각 속성의 검증 결과를 JSON 형식으로 저장해야 한다. JSON에는 속성명, 검증 시간, 측정 ID 일치 여부, GTM ID 일치 여부, 발견된 이슈 목록, 스크린샷 경로가 포함되어야 한다.

**FR12**: 시스템은 30일 이상 경과한 스크린샷과 JSON 결과를 자동으로 삭제하여 스토리지를 관리해야 한다.

**FR13**: 시스템은 검증 실패(측정 ID 불일치, GTM ID 불일치, page_view 미발생 등) 발견 시 Slack Webhook을 통해 지정된 채널로 알림을 발송해야 한다.

**FR14**: Slack 알림에는 속성명, 이슈 유형, 검증 시간, 스크린샷 파일 경로가 포함되어야 한다. 알림은 즉시 발송되어야 하며, 배치 처리로 인한 지연이 없어야 한다.

**FR15**: 시스템은 네트워크 타임아웃, 사이트 일시 다운 등 일시적 오류를 처리하기 위해 최대 3회 재시도 로직을 구현해야 한다. 3회 실패 시에만 이슈로 기록해야 한다.

**FR16**: 시스템은 Playwright stealth mode를 활성화하여 bot detection을 우회해야 한다. User-Agent는 일반 브라우저와 동일하게 설정되어야 한다.

**FR17**: 시스템은 전체 검증 실행의 시작 시간, 종료 시간, 처리된 속성 수, 성공/실패 건수를 로그 파일에 기록해야 한다.

**FR18**: 시스템은 실행 중 치명적 오류(서버 다운, CSV 파일 없음 등) 발생 시 Slack으로 긴급 알림을 발송하고, 로그에 상세 에러 메시지를 기록해야 한다.

### Non-Functional Requirements

**NFR1**: 시스템은 100개 속성 전체 검증을 2시간 이내에 완료해야 한다. 5개 병렬 브라우저를 사용하여 평균 1.5시간 목표를 달성해야 한다.

**NFR2**: 시스템은 월 99.5% 이상의 가용성을 유지해야 한다(월 최대 3.6시간 다운타임 허용). cron job 실행 실패 시 자동 재시도 및 알림이 발생해야 한다.

**NFR3**: 시스템의 False positive rate은 5% 이하를 유지해야 한다. 실제 문제가 아닌데 알림이 발생하는 비율을 최소화해야 한다.

**NFR4**: 시스템의 False negative rate은 5% 이하를 유지해야 한다. 실제 문제를 놓치는 비율을 최소화해야 한다.

**NFR5**: 시스템은 브라우저당 최대 500MB 메모리를 사용해야 하며, 전체 시스템은 3GB 이하의 메모리를 사용해야 한다.

**NFR6**: 시스템은 사내 Linux 서버(최소 CPU 4 core, RAM 8GB)에서 안정적으로 실행되어야 한다. 추가 서버 구매 없이 기존 리소스 내에서 동작해야 한다.

**NFR7**: 시스템은 사내 네트워크 내부에서만 실행되며, 외부 인터넷 노출이 없어야 한다. 스크린샷 저장 폴더는 디지털 애널리틱스 팀만 접근 가능하도록 권한 설정되어야 한다.

**NFR8**: 시스템은 속성 수가 30% 증가(130개)하더라도 브라우저 수 조정(5개 → 7개)만으로 동일한 검증 시간(2시간 이내)을 유지할 수 있어야 한다.

**NFR9**: 코드는 모듈화된 구조(7개 모듈: orchestrator, browserPoolManager, networkEventCapturer, propertyUrlResolver, configValidator, resultStorage, csvColumnNames)를 유지하여 개별 컴포넌트의 독립 수정이 가능해야 한다.

**NFR10**: 시스템은 Node.js 18 이상에서 실행되어야 하며, ES Modules를 사용해야 한다. CommonJS는 사용하지 않는다.

**NFR11**: 모든 외부 의존성(Playwright, csv-parser 등)은 package.json에 명시되어야 하며, 버전은 semantic versioning을 따라야 한다.

**NFR12**: 시스템은 idempotent하게 설계되어야 한다. 동일한 날짜에 재실행 시 기존 결과를 덮어쓰고, 중복 알림이 발생하지 않아야 한다.

---

## Technical Assumptions

### Repository Structure

**Monorepo 구조 채택**

시스템은 단일 저장소에 7개 모듈을 포함하는 Monorepo 구조로 설계됩니다. 이는 PoC 시스템의 검증된 아키텍처를 계승하며, 다음과 같은 이점을 제공합니다:

- **모듈 간 의존성 관리 용이**: 단일 package.json으로 통합 관리
- **코드 공유 간소화**: 공통 유틸리티와 타입 정의 재사용
- **배포 간소화**: 단일 빌드 및 배포 파이프라인
- **버전 관리 일관성**: 모든 모듈의 버전을 동기화하여 호환성 보장

**모듈 구조**:
```
ga4TechIssueCatcher/
├── src/
│   ├── orchestrator/          # 메인 실행 로직 및 워크플로우 조율
│   ├── browserPoolManager/    # Playwright 브라우저 풀 관리
│   ├── networkEventCapturer/  # CDP 네트워크 이벤트 감청
│   ├── propertyUrlResolver/   # CSV 파싱 및 속성 URL 해석
│   ├── configValidator/       # GA4/GTM 설정 검증 로직
│   ├── resultStorage/         # JSON 결과 저장 및 스크린샷 관리
│   └── csvColumnNames/        # CSV 컬럼명 상수 정의
├── tests/                     # E2E 및 단위 테스트
├── docs/                      # 프로젝트 문서
└── package.json              # 통합 의존성 관리
```

### Service Architecture

**Standalone Node.js Application**

시스템은 외부 서비스 의존성 없이 독립적으로 실행되는 Node.js 애플리케이션으로 설계됩니다:

- **런타임**: Node.js 18 LTS (Long-Term Support)
- **모듈 시스템**: ES Modules (ESM) - CommonJS 미사용
- **브라우저 자동화**: Playwright with Chromium
- **네트워크 감청**: Chrome DevTools Protocol (CDP)
- **알림 전송**: Slack Incoming Webhooks API
- **스케줄링**: Linux cron daemon

**실행 환경**:
- **서버**: 사내 Linux 서버 (Ubuntu 20.04 LTS 이상 권장)
- **최소 사양**: CPU 4 core, RAM 8GB, Storage 100GB
- **네트워크**: 사내 네트워크 내부 실행, 외부 인터넷 미노출
- **권한**: 디지털 애널리틱스 팀 전용 접근 권한

**외부 의존성**:
```json
{
  "playwright": "^1.40.0",      // 브라우저 자동화
  "csv-parser": "^3.0.0",       // CSV 파싱
  "node-fetch": "^3.3.0",       // Slack Webhook 호출
  "winston": "^3.11.0"          // 로깅
}
```

### Testing Requirements

**E2E 테스트 전략**

시스템의 브라우저 자동화 특성상 E2E(End-to-End) 테스트를 중심으로 검증합니다:

**테스트 범위**:
- **Happy Path**: 정상적인 GA4/GTM 설정 검증 시나리오
- **Error Cases**: 측정 ID 불일치, GTM ID 불일치, page_view 미발생
- **Edge Cases**: 네트워크 타임아웃, 사이트 다운, CSV 파싱 오류
- **Retry Logic**: 3회 재시도 동작 검증
- **Idempotency**: 동일 날짜 재실행 시 결과 덮어쓰기 검증

**테스트 환경**:
- **테스트 속성**: 3개의 테스트 전용 속성 (정상, 불일치, 오류 시나리오)
- **테스트 CSV**: `test/fixtures/test-properties.csv`
- **Mock Slack**: Slack Webhook 호출을 로컬 서버로 리다이렉트

**테스트 도구**:
- **Framework**: Playwright Test
- **Assertion Library**: Node.js built-in assert
- **Coverage Target**: 80% 이상 (orchestrator, configValidator 모듈 중심)

**CI/CD 통합**:
- **Pre-commit**: ESLint, Prettier 실행
- **Pre-push**: 단위 테스트 및 E2E 테스트 실행
- **Daily CI**: 전체 테스트 스위트 실행 및 커버리지 리포트 생성

### Additional Technical Assumptions

**가정사항 1: Chromium 브라우저 사용**
- Playwright는 Chromium, Firefox, WebKit을 지원하지만, 본 프로젝트는 Chromium만 사용합니다.
- 이유: Amorepacific 디지털 속성의 90% 이상이 Chrome 기준으로 개발되어 호환성이 높습니다.

**가정사항 2: CSV 파일 형식 고정**
- CSV 컬럼 구조(계정명, 속성명, Measurement ID, GTM ID 등)는 변경되지 않습니다.
- 신규 컬럼 추가 시 하위 호환성을 유지하며, 기존 컬럼 순서는 변경하지 않습니다.

**가정사항 3: 사내 네트워크 접근 가능**
- 모든 검증 대상 속성은 사내 네트워크에서 접근 가능합니다.
- VPN이나 프록시 설정이 필요한 경우, 서버 레벨에서 사전 구성됩니다.

**가정사항 4: Slack Webhook URL 관리**
- Slack Webhook URL은 환경변수(`.env` 파일)로 관리됩니다.
- `.env` 파일은 `.gitignore`에 추가되어 버전 관리에서 제외됩니다.

**가정사항 5: 스크린샷 저장 용량**
- 속성당 평균 스크린샷 크기 2MB 가정 시, 30일간 약 6GB 저장 공간 필요 (100 속성 × 2MB × 30일).
- 서버 스토리지 100GB는 충분한 여유 공간을 제공합니다.

**가정사항 6: Bot Detection 우회**
- Playwright stealth mode와 일반 User-Agent 설정으로 대부분의 bot detection을 우회할 수 있습니다.
- 추가 우회가 필요한 경우, 개별 속성별 커스텀 스크립트를 구현합니다.

**가정사항 7: Node.js 18 LTS 지원**
- Node.js 18 LTS는 2025년 4월까지 Active LTS 지원을 받으며, 2028년 4월까지 Maintenance LTS 지원됩니다.
- 프로젝트 기간 동안 안정적인 런타임 환경이 보장됩니다.

---

## Epic List

본 섹션에서는 Requirements를 논리적인 개발 단위인 Epic으로 그룹화합니다. 각 Epic은 우선순위(P0: MVP 필수, P1: 중요, P2: 개선사항)와 연관된 User Stories를 포함합니다.

### Epic 1: CSV Property Management System (P0)

**목표**: CSV 파일 기반 속성 관리 시스템 구축

**설명**:
Amorepacific의 100개 이상 디지털 속성 메타데이터를 CSV 파일로 관리하고, 자동으로 로드/파싱하여 검증 대상을 동적으로 업데이트하는 시스템을 구현합니다. 이는 별도의 코드 수정이나 재배포 없이 CSV 파일 수정만으로 속성 추가/제거를 가능하게 합니다.

**연관 Requirements**: FR1, FR2, NFR9, NFR10, NFR11

**우선순위**: P0 (MVP 필수 기능)

**이유**: CSV 기반 속성 관리는 시스템의 핵심 입력 데이터 소스이며, 모든 검증 작업의 기반이 됩니다.

---

### Epic 2: Browser Automation & Parallel Crawling (P0)

**목표**: Playwright 기반 병렬 브라우저 자동화 시스템 구축

**설명**:
Playwright를 사용하여 Chromium 브라우저 5개를 병렬로 실행하고, 브라우저 풀 관리(acquireBrowser, releaseBrowser)를 통해 효율적으로 100개 속성을 2시간 내 검증하는 시스템을 구현합니다. Bot detection 우회를 위한 stealth mode와 일반 User-Agent 설정을 포함합니다.

**연관 Requirements**: FR3, FR4, FR16, NFR1, NFR5, NFR6, NFR8

**우선순위**: P0 (MVP 필수 기능)

**이유**: 병렬 브라우저 자동화는 2시간 내 100개 속성 검증이라는 성능 목표 달성의 핵심입니다.

---

### Epic 3: GA4/GTM Configuration Validation (P0)

**목표**: Chrome DevTools Protocol 기반 GA4/GTM 설정 검증 시스템 구축

**설명**:
Chrome DevTools Protocol(CDP)을 사용하여 네트워크 요청을 감청하고, `analytics.google.com/g/collect` 패턴의 GA4 이벤트를 캡처합니다. 측정 ID, GTM 컨테이너 ID, page_view 이벤트 발생 여부를 CSV 파일의 기대값과 비교 검증하며, Amorepacific 특화 설정(AP_DATA)도 추출하여 검증합니다.

**연관 Requirements**: FR5, FR6, FR7, FR8, FR9, NFR3, NFR4

**우선순위**: P0 (MVP 필수 기능)

**이유**: GA4/GTM 설정 검증은 시스템의 핵심 비즈니스 가치이며, 데이터 손실 방지라는 주요 목표를 달성하는 핵심 기능입니다.

---

### Epic 4: Result Storage & Screenshot Management (P1)

**목표**: 검증 결과 저장 및 스크린샷 관리 시스템 구축

**설명**:
각 속성의 검증 결과를 JSON 형식으로 저장하고, fullPage 스크린샷을 날짜별 폴더 구조(YYYY-MM-DD)로 저장합니다. 30일 이상 경과한 데이터를 자동으로 삭제하여 스토리지를 효율적으로 관리하며, 증거 기반 트러블슈팅을 지원합니다.

**연관 Requirements**: FR10, FR11, FR12, NFR7

**우선순위**: P1 (중요 기능)

**이유**: 검증 증거 저장은 히스토리 추적 및 트러블슈팅에 중요하지만, 시스템의 핵심 검증 기능은 아닙니다.

---

### Epic 5: Alert & Notification System (P0)

**목표**: Slack 기반 실시간 알림 시스템 구축

**설명**:
검증 실패(측정 ID 불일치, GTM ID 불일치, page_view 미발생) 발견 시 Slack Webhook을 통해 지정된 채널로 즉시 알림을 발송합니다. 알림에는 속성명, 이슈 유형, 검증 시간, 스크린샷 파일 경로가 포함되며, 치명적 오류 발생 시 긴급 알림을 발송합니다.

**연관 Requirements**: FR13, FR14, FR18, NFR2

**우선순위**: P0 (MVP 필수 기능)

**이유**: 실시간 알림은 이슈 발견 시간을 24시간 내로 단축하는 핵심 기능이며, 팀의 빠른 대응을 가능하게 합니다.

---

### Epic 6: Error Handling & Retry Logic (P1)

**목표**: 견고한 에러 처리 및 재시도 로직 구현

**설명**:
네트워크 타임아웃, 사이트 일시 다운 등 일시적 오류를 처리하기 위해 최대 3회 재시도 로직을 구현합니다. 3회 실패 시에만 이슈로 기록하여 False positive rate을 5% 이하로 유지합니다.

**연관 Requirements**: FR15, NFR3, NFR4

**우선순위**: P1 (중요 기능)

**이유**: 재시도 로직은 시스템 안정성과 False positive rate 감소에 중요하지만, MVP의 핵심 기능은 아닙니다.

---

### Epic 7: Logging & Monitoring (P1)

**목표**: 시스템 실행 로깅 및 모니터링 구축

**설명**:
전체 검증 실행의 시작 시간, 종료 시간, 처리된 속성 수, 성공/실패 건수를 로그 파일에 기록합니다. 실행 중 치명적 오류 발생 시 로그에 상세 에러 메시지를 기록하여 트러블슈팅을 지원합니다.

**연관 Requirements**: FR17, FR18, NFR2, NFR12

**우선순위**: P1 (중요 기능)

**이유**: 로깅은 시스템 운영 및 트러블슈팅에 중요하지만, MVP의 핵심 검증 기능은 아닙니다.

---

## Epic Details

### Epic 1: CSV Property Management System

#### User Story 1.1: CSV 파일 로드 및 파싱

**Story**: As a 디지털 애널리틱스 팀원, I want CSV 파일에서 속성 메타데이터를 자동으로 로드하고 파싱하기를 원합니다, so that 코드 수정 없이 검증 대상 속성을 관리할 수 있습니다.

**Acceptance Criteria**:
- [ ] 시스템은 `src/ga4Property/Amore_GA4_PropertList.csv` 파일을 읽을 수 있다
- [ ] CSV 파일이 존재하지 않으면 명확한 에러 메시지를 출력한다
- [ ] CSV 파일의 인코딩은 UTF-8을 지원한다
- [ ] CSV 헤더 행을 올바르게 파싱하여 컬럼명을 식별한다
- [ ] 빈 행이나 주석 행(#으로 시작)을 무시한다

#### User Story 1.2: 속성 메타데이터 추출

**Story**: As a 디지털 애널리틱스 팀원, I want CSV에서 각 속성의 측정 ID, GTM ID, URL, whitelist를 추출하기를 원합니다, so that 검증에 필요한 모든 정보를 사용할 수 있습니다.

**Acceptance Criteria**:
- [ ] 각 속성의 측정 ID(G-XXXXXXXXX)를 추출한다
- [ ] 각 속성의 GTM 컨테이너 ID(GTM-XXXXXXXX)를 추출한다
- [ ] 각 속성의 대표 URL을 추출한다
- [ ] Whitelist 도메인 목록을 추출하여 배열로 저장한다
- [ ] 필수 필드(측정 ID, URL)가 누락된 행은 경고 로그를 출력하고 건너뛴다

#### User Story 1.3: CSV 업데이트 감지

**Story**: As a 디지털 애널리틱스 팀원, I want CSV 파일이 업데이트되면 자동으로 새로운 속성을 감지하기를 원합니다, so that 재배포 없이 속성을 추가/제거할 수 있습니다.

**Acceptance Criteria**:
- [ ] 매 실행 시 CSV 파일을 새로 읽어서 최신 데이터를 사용한다
- [ ] 이전 실행 대비 추가된 속성을 로그에 기록한다
- [ ] 이전 실행 대비 제거된 속성을 로그에 기록한다
- [ ] CSV 파일 수정 후 다음 실행 시 변경사항이 즉시 반영된다

---

### Epic 2: Browser Automation & Parallel Crawling

#### User Story 2.1: Playwright 브라우저 풀 구성

**Story**: As a 시스템 개발자, I want Playwright를 사용하여 브라우저 풀을 구성하기를 원합니다, so that 리소스를 효율적으로 관리하며 병렬 크롤링을 수행할 수 있습니다.

**Acceptance Criteria**:
- [ ] Chromium 브라우저 5개를 초기화하여 브라우저 풀을 생성한다
- [ ] `acquireBrowser()` 함수로 사용 가능한 브라우저를 할당받는다
- [ ] `releaseBrowser()` 함수로 사용 완료된 브라우저를 풀에 반환한다
- [ ] 브라우저당 최대 500MB 메모리 사용을 제한한다
- [ ] 모든 검증 완료 후 브라우저 풀을 정상적으로 종료한다

#### User Story 2.2: 병렬 브라우저 실행

**Story**: As a 시스템 개발자, I want 5개 브라우저를 병렬로 실행하여 속성을 검증하기를 원합니다, so that 100개 속성을 2시간 내 검증할 수 있습니다.

**Acceptance Criteria**:
- [ ] 100개 속성을 5개 브라우저에 균등 분배한다(각 브라우저당 20개)
- [ ] 각 브라우저는 할당된 속성을 순차적으로 방문하여 검증한다
- [ ] 한 브라우저의 오류가 다른 브라우저 실행을 중단시키지 않는다
- [ ] 전체 검증 시간이 2시간을 초과하지 않는다(평균 1.5시간 목표)
- [ ] 각 속성 검증 후 브라우저 컨텍스트를 초기화하여 상태 오염을 방지한다

#### User Story 2.3: Stealth Mode 설정

**Story**: As a 시스템 개발자, I want Playwright stealth mode를 활성화하기를 원합니다, so that bot detection을 우회하고 정상적인 검증을 수행할 수 있습니다.

**Acceptance Criteria**:
- [ ] Playwright stealth plugin을 설치하고 활성화한다
- [ ] User-Agent를 일반 Chrome 브라우저와 동일하게 설정한다
- [ ] `navigator.webdriver` 속성을 숨긴다
- [ ] Headless mode를 사용하되, headless detection을 우회한다
- [ ] 속성 검증 시 bot detection 경고나 차단이 발생하지 않는다

#### User Story 2.4: Cron Job 자동 실행

**Story**: As a 디지털 애널리틱스 팀원, I want 시스템이 매일 새벽 3시에 자동으로 실행되기를 원합니다, so that 수동 트리거 없이 일일 검증을 수행할 수 있습니다.

**Acceptance Criteria**:
- [ ] Linux cron daemon에 스케줄 등록(`0 3 * * *`)
- [ ] cron job 실행 시 적절한 환경변수를 로드한다(.env 파일)
- [ ] cron job 실행 실패 시 에러 로그를 기록한다
- [ ] 실행 시작 및 종료를 로그에 기록한다
- [ ] 이전 실행이 완료되지 않았을 경우 새 실행을 건너뛴다(중복 실행 방지)

---

### Epic 3: GA4/GTM Configuration Validation

#### User Story 3.1: CDP 네트워크 이벤트 캡처

**Story**: As a 시스템 개발자, I want Chrome DevTools Protocol을 사용하여 네트워크 요청을 감청하기를 원합니다, so that GA4 이벤트를 캡처하여 검증할 수 있습니다.

**Acceptance Criteria**:
- [ ] CDP를 활성화하여 네트워크 이벤트를 감청한다
- [ ] `analytics.google.com/g/collect` 패턴의 요청을 필터링한다
- [ ] 캡처된 요청의 URL 파라미터를 파싱하여 측정 ID와 이벤트 정보를 추출한다
- [ ] 페이지 로드 후 최대 10초간 네트워크 이벤트를 대기한다
- [ ] 캡처된 모든 GA4 이벤트를 배열로 저장한다

#### User Story 3.2: 측정 ID 검증

**Story**: As a 디지털 애널리틱스 팀원, I want 캡처된 GA4 이벤트의 측정 ID를 CSV 기대값과 비교하기를 원합니다, so that 올바른 GA4 속성으로 데이터가 전송되는지 확인할 수 있습니다.

**Acceptance Criteria**:
- [ ] 캡처된 GA4 이벤트에서 측정 ID(G-XXXXXXXXX)를 추출한다
- [ ] CSV 파일의 기대 측정 ID와 일치 여부를 확인한다
- [ ] 측정 ID 불일치 시 이슈로 기록한다
- [ ] 측정 ID가 전혀 감지되지 않으면 "측정 ID 없음" 이슈로 기록한다
- [ ] 검증 결과(일치/불일치)를 JSON 결과에 저장한다

#### User Story 3.3: GTM 컨테이너 ID 검증

**Story**: As a 디지털 애널리틱스 팀원, I want 페이지의 GTM 스크립트에서 컨테이너 ID를 추출하여 CSV 기대값과 비교하기를 원합니다, so that 올바른 GTM 컨테이너가 로드되는지 확인할 수 있습니다.

**Acceptance Criteria**:
- [ ] 페이지 HTML에서 GTM 스크립트 태그를 검색한다
- [ ] GTM 컨테이너 ID(GTM-XXXXXXXX)를 정규식으로 추출한다
- [ ] CSV 파일의 기대 GTM ID와 일치 여부를 확인한다
- [ ] GTM ID 불일치 시 이슈로 기록한다
- [ ] GTM 스크립트가 전혀 없으면 "GTM 없음" 이슈로 기록한다
- [ ] 검증 결과(일치/불일치)를 JSON 결과에 저장한다

#### User Story 3.4: page_view 이벤트 검증

**Story**: As a 디지털 애널리틱스 팀원, I want page_view 이벤트가 정상적으로 발생하는지 확인하기를 원합니다, so that 기본 페이지뷰 추적이 동작하는지 검증할 수 있습니다.

**Acceptance Criteria**:
- [ ] 캡처된 GA4 이벤트 중 `page_view` 이벤트를 검색한다
- [ ] `page_view` 이벤트가 최소 1회 발생했는지 확인한다
- [ ] `page_view` 이벤트 미발생 시 이슈로 기록한다
- [ ] 검증 결과(발생/미발생)를 JSON 결과에 저장한다

#### User Story 3.5: AP_DATA 환경변수 검증

**Story**: As a 디지털 애널리틱스 팀원, I want 페이지의 AP_DATA 환경변수를 추출하여 검증하기를 원합니다, so that Amorepacific 특화 설정이 올바른지 확인할 수 있습니다.

**Acceptance Criteria**:
- [ ] 페이지의 전역 변수 `window.AP_DATA`를 검색한다
- [ ] Data layer에서 `AP_DATA` 객체를 검색한다
- [ ] `AP_DATA`가 존재하면 내용을 JSON 결과에 저장한다
- [ ] `AP_DATA`가 없으면 경고 로그를 출력하지만 이슈로 기록하지는 않는다
- [ ] `AP_DATA` 추출 실패 시에도 다른 검증은 계속 진행한다

---

### Epic 4: Result Storage & Screenshot Management

#### User Story 4.1: 검증 결과 JSON 저장

**Story**: As a 디지털 애널리틱스 팀원, I want 각 속성의 검증 결과를 JSON 형식으로 저장하기를 원합니다, so that 히스토리를 추적하고 트러블슈팅할 수 있습니다.

**Acceptance Criteria**:
- [ ] JSON 파일에 속성명, 검증 시간, 측정 ID 일치 여부를 저장한다
- [ ] JSON 파일에 GTM ID 일치 여부, page_view 발생 여부를 저장한다
- [ ] JSON 파일에 발견된 이슈 목록(배열)을 저장한다
- [ ] JSON 파일에 스크린샷 파일 경로를 저장한다
- [ ] JSON 파일은 날짜별 폴더에 저장된다(`results/YYYY-MM-DD/property-name.json`)
- [ ] JSON은 읽기 쉽도록 들여쓰기(pretty print)된다

#### User Story 4.2: fullPage 스크린샷 캡처

**Story**: As a 디지털 애널리틱스 팀원, I want 각 속성의 fullPage 스크린샷을 캡처하기를 원합니다, so that 시각적 증거를 확보하고 문제 상황을 확인할 수 있습니다.

**Acceptance Criteria**:
- [ ] 검증 후 Playwright의 `screenshot({ fullPage: true })`를 사용한다
- [ ] 스크린샷 파일명에 속성명과 타임스탬프를 포함한다(`property-name_YYYYMMDD-HHmmss.png`)
- [ ] 스크린샷은 날짜별 폴더에 저장된다(`screenshots/YYYY-MM-DD/`)
- [ ] 스크린샷 캡처 실패 시 에러 로그를 기록하지만 검증은 계속 진행한다
- [ ] 스크린샷 파일 크기가 10MB를 초과하면 경고 로그를 출력한다

#### User Story 4.3: 30일 경과 데이터 삭제

**Story**: As a 시스템 관리자, I want 30일 이상 경과한 스크린샷과 JSON 결과를 자동으로 삭제하기를 원합니다, so that 스토리지를 효율적으로 관리할 수 있습니다.

**Acceptance Criteria**:
- [ ] 매 실행 시작 시 30일 이상 경과한 폴더를 검색한다
- [ ] 해당 폴더의 모든 파일을 삭제한다
- [ ] 삭제된 폴더 개수와 파일 개수를 로그에 기록한다
- [ ] 삭제 실패 시 에러 로그를 기록하지만 검증은 계속 진행한다
- [ ] 현재 날짜 폴더는 30일 경과 여부와 무관하게 삭제하지 않는다

---

### Epic 5: Alert & Notification System

#### User Story 5.1: Slack Webhook 알림 발송

**Story**: As a 디지털 애널리틱스 팀원, I want 검증 실패 시 Slack으로 알림을 받기를 원합니다, so that 이슈를 즉시 인지하고 대응할 수 있습니다.

**Acceptance Criteria**:
- [ ] Slack Webhook URL을 환경변수에서 로드한다
- [ ] 측정 ID 불일치 시 Slack 알림을 발송한다
- [ ] GTM ID 불일치 시 Slack 알림을 발송한다
- [ ] page_view 미발생 시 Slack 알림을 발송한다
- [ ] 알림은 즉시 발송되며, 배치 처리로 인한 지연이 없다
- [ ] Slack 발송 실패 시 에러 로그를 기록하지만 검증은 계속 진행한다

#### User Story 5.2: 알림 메시지 포맷팅

**Story**: As a 디지털 애널리틱스 팀원, I want Slack 알림에 필요한 정보가 포함되기를 원합니다, so that 알림만으로도 문제 상황을 파악할 수 있습니다.

**Acceptance Criteria**:
- [ ] 알림에 속성명을 포함한다
- [ ] 알림에 이슈 유형(측정 ID 불일치, GTM ID 불일치 등)을 포함한다
- [ ] 알림에 검증 시간을 포함한다
- [ ] 알림에 스크린샷 파일 경로를 포함한다
- [ ] 알림 메시지는 Slack Markdown 형식으로 포맷팅한다
- [ ] 치명적 오류 시 `@channel` 멘션을 포함하여 긴급 알림을 발송한다

---

### Epic 6: Error Handling & Retry Logic

#### User Story 6.1: 재시도 로직 구현

**Story**: As a 시스템 개발자, I want 일시적 오류 발생 시 최대 3회 재시도하기를 원합니다, so that 네트워크 타임아웃이나 일시적 다운으로 인한 False positive를 줄일 수 있습니다.

**Acceptance Criteria**:
- [ ] 속성 검증 실패 시 최대 3회 재시도한다
- [ ] 재시도 간격은 exponential backoff(1초, 2초, 4초)를 사용한다
- [ ] 3회 재시도 후에도 실패하면 이슈로 기록한다
- [ ] 재시도 횟수를 로그에 기록한다
- [ ] 네트워크 타임아웃, HTTP 5xx 에러, 사이트 다운 시 재시도를 수행한다
- [ ] 측정 ID 불일치, GTM ID 불일치 등 설정 오류는 재시도하지 않는다

---

### Epic 7: Logging & Monitoring

#### User Story 7.1: 실행 로그 기록

**Story**: As a 시스템 관리자, I want 시스템 실행의 모든 주요 이벤트를 로그에 기록하기를 원합니다, so that 트러블슈팅하고 시스템 운영 상태를 모니터링할 수 있습니다.

**Acceptance Criteria**:
- [ ] 전체 검증 실행의 시작 시간을 로그에 기록한다
- [ ] 전체 검증 실행의 종료 시간을 로그에 기록한다
- [ ] 처리된 속성 수, 성공 건수, 실패 건수를 로그에 기록한다
- [ ] 각 속성의 검증 시작/종료를 로그에 기록한다
- [ ] 치명적 오류(서버 다운, CSV 파일 없음 등) 발생 시 상세 에러 메시지를 로그에 기록한다
- [ ] 로그 파일은 날짜별로 로테이션된다(`logs/YYYY-MM-DD.log`)
- [ ] 로그 레벨(INFO, WARN, ERROR)을 구분하여 기록한다

---

## Next Steps

### 1. Architecture 문서 작성

PRD가 완료되었으므로, 다음 단계는 시스템 아키텍처 문서를 작성하는 것입니다. Architecture 문서는 다음을 포함해야 합니다:

**시스템 아키텍처 다이어그램**:
- 7개 모듈 간의 의존성 관계
- 데이터 흐름 (CSV → 브라우저 → 검증 → 저장 → 알림)
- 외부 시스템 연동 (Slack Webhook)

**모듈별 상세 설계**:
- `orchestrator`: 메인 실행 로직 및 워크플로우 조율
- `browserPoolManager`: Playwright 브라우저 풀 관리 및 리소스 할당
- `networkEventCapturer`: CDP 네트워크 이벤트 감청 및 GA4 이벤트 캡처
- `propertyUrlResolver`: CSV 파싱 및 속성 URL 해석
- `configValidator`: GA4/GTM 설정 검증 로직
- `resultStorage`: JSON 결과 저장 및 스크린샷 관리
- `csvColumnNames`: CSV 컬럼명 상수 정의

**데이터 모델**:
- Property 객체: CSV에서 로드된 속성 메타데이터
- ValidationResult 객체: 검증 결과 데이터 구조
- IssueReport 객체: 발견된 이슈 정보

**API 인터페이스**:
- 각 모듈의 Public API 정의
- 함수 시그니처 및 입출력 파라미터

### 2. 개발 환경 설정

**필수 설치 항목**:
- Node.js 18 LTS 설치
- Playwright Chromium 설치 (`npx playwright install chromium`)
- 프로젝트 의존성 설치 (`npm install`)

**환경변수 설정**:
- `.env.example` 파일을 `.env`로 복사
- Slack Webhook URL 설정
- 기타 환경 설정 (로그 레벨, 브라우저 수 등)

**CSV 파일 준비**:
- `src/ga4Property/Amore_GA4_PropertList.csv` 파일 확인
- 100개 속성 메타데이터 검증 (측정 ID, GTM ID, URL, whitelist)

### 3. 개발 우선순위

Epic 우선순위에 따라 다음 순서로 개발을 진행합니다:

**Phase 1 (Week 1-2): Core MVP (P0 기능)**
1. Epic 1: CSV Property Management System
2. Epic 2: Browser Automation & Parallel Crawling
3. Epic 3: GA4/GTM Configuration Validation

**Phase 2 (Week 3-4): Integration & Testing (P0 기능)**
4. Epic 5: Alert & Notification System
5. E2E 테스트 작성 및 실행
6. 10개 속성 대상 파일럿 테스트

**Phase 3 (Week 5-6): Production Ready (P1 기능)**
7. Epic 4: Result Storage & Screenshot Management
8. Epic 6: Error Handling & Retry Logic
9. Epic 7: Logging & Monitoring
10. 100개 속성 대상 전체 테스트

**Phase 4 (Week 7-8): Deployment & Monitoring**
11. Linux 서버 배포
12. Cron job 설정 및 자동화
13. 운영 모니터링 및 안정화

### 4. 품질 보증

**테스트 전략**:
- 단위 테스트: 각 모듈의 핵심 로직 (80% 커버리지 목표)
- E2E 테스트: 전체 검증 워크플로우 (3개 시나리오: 정상, 불일치, 오류)
- 성능 테스트: 100개 속성 2시간 내 검증 달성 여부
- False positive/negative rate 측정: 5% 이하 목표 검증

**문서화**:
- README.md: 프로젝트 개요, 설치 및 실행 방법
- CONTRIBUTING.md: 코드 기여 가이드라인
- API.md: 각 모듈의 API 문서
- TROUBLESHOOTING.md: 일반적인 문제 해결 가이드

### 5. 위험 관리

**주요 위험 요소**:
- **Bot Detection**: Playwright stealth mode 실패 시 → 개별 속성별 커스텀 우회 로직 구현
- **GA4 스크립트 변경**: Google Analytics 업데이트 시 → 정기적인 검증 로직 업데이트 필요
- **CSV 관리 오류**: 잘못된 데이터 입력 시 → CSV 유효성 검사 로직 강화
- **성능 목표 미달성**: 2시간 초과 시 → 브라우저 수 증가(5개 → 7개) 또는 병렬 처리 최적화

**리스크 완화 계획**:
- 주간 코드 리뷰 및 QA 세션
- 파일럿 테스트 결과 기반 개선 (10개 속성 → 100개 속성)
- 정기적인 성능 벤치마크 측정 및 최적화

---

## Document Approval

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Business Analyst | Mary | 2025-10-29 | ✓ Approved |
| Product Manager | TBD | | |
| Tech Lead | TBD | | |
| QA Lead | TBD | | |

---

## References

- [Project Brief](/Users/seong-won-yeong/Dev/ga4TechIssueCatcher/docs/brief.md)
- [PoC System](/Users/seong-won-yeong/Documents/Project/ga4IssueCatcher/)
- [Playwright Documentation](https://playwright.dev/)
- [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/)
- [Google Analytics 4 Documentation](https://developers.google.com/analytics/devguides/collection/ga4)
- [Slack Incoming Webhooks](https://api.slack.com/messaging/webhooks)

---

**Document Version**: 1.0
**Last Updated**: 2025-10-29
**Author**: Mary (Business Analyst)
**Status**: ✅ Completed

