# GA4 Tech Issue Catcher - System Architecture

## Document Information

| Field | Value |
|-------|-------|
| **Document Version** | 1.0 |
| **Last Updated** | 2025-10-29 |
| **Author** | Mary (Business Analyst) |
| **Status** | ✅ In Progress |
| **Related Documents** | [Project Brief](brief.md), [PRD](prd.md) |

---

## Table of Contents

1. [System Overview](#system-overview)
2. [High-Level Architecture](#high-level-architecture)
3. [Module Architecture](#module-architecture)
4. [Data Flow](#data-flow)
5. [Data Models](#data-models)
6. [API Interfaces](#api-interfaces)
7. [Deployment Architecture](#deployment-architecture)
8. [Technology Stack](#technology-stack)
9. [Security Architecture](#security-architecture)
10. [Performance & Scalability](#performance--scalability)

---

## System Overview

### Purpose

**GA4 Tech Issue Catcher**는 Amorepacific의 100개 이상 디지털 속성에서 GA4/GTM 설정을 자동으로 검증하는 브라우저 자동화 시스템입니다. Playwright를 사용하여 병렬로 속성을 크롤링하고, Chrome DevTools Protocol(CDP)을 통해 GA4 이벤트를 감청하여 설정 오류를 조기에 발견합니다.

### Key Characteristics

- **Standalone Application**: 외부 서비스 의존성 없는 독립 실행형 Node.js 애플리케이션
- **Parallel Processing**: 5개 Chromium 브라우저를 병렬로 실행하여 2시간 내 100개 속성 검증
- **Event-Driven Validation**: CDP 네트워크 이벤트 감청을 통한 실시간 GA4 이벤트 캡처
- **Evidence-Based Reporting**: 스크린샷 및 JSON 결과를 저장하여 증거 기반 트러블슈팅 지원
- **Real-Time Alerting**: Slack Webhook을 통한 즉각적인 이슈 알림

### Design Principles

1. **Modularity**: 7개 독립 모듈로 구성하여 개별 수정 및 테스트 용이
2. **Idempotency**: 동일 날짜 재실행 시 결과 덮어쓰기로 중복 방지
3. **Fault Tolerance**: 한 브라우저의 오류가 전체 실행을 중단시키지 않음
4. **Resource Efficiency**: 브라우저 풀 관리를 통한 메모리 효율성 (전체 3GB 이하)
5. **Observability**: 상세한 로깅과 모니터링으로 운영 가시성 확보

---

## High-Level Architecture

### System Context Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    GA4 Tech Issue Catcher                       │
│                                                                 │
│  ┌──────────────┐      ┌─────────────┐      ┌──────────────┐  │
│  │   CSV File   │─────▶│ Orchestrator│─────▶│   Browser    │  │
│  │  (Properties)│      │             │      │     Pool     │  │
│  └──────────────┘      └─────────────┘      └──────────────┘  │
│                              │                      │          │
│                              ▼                      ▼          │
│                        ┌─────────────┐      ┌──────────────┐  │
│                        │  Validator  │◀─────│   Network    │  │
│                        │             │      │   Capturer   │  │
│                        └─────────────┘      └──────────────┘  │
│                              │                                 │
│                              ▼                                 │
│                        ┌─────────────┐      ┌──────────────┐  │
│                        │   Storage   │      │    Slack     │  │
│                        │  (Results)  │      │   Webhook    │  │
│                        └─────────────┘      └──────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │                      │
                              ▼                      ▼
                    ┌──────────────────┐    ┌──────────────────┐
                    │   File System    │    │  Slack Channel   │
                    │ (JSON, Screenshots)│  │   (#analytics)   │
                    └──────────────────┘    └──────────────────┘
```

### Component Interaction

```
┌────────────┐
│   Cron     │ (Daily 3AM)
└─────┬──────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Orchestrator                             │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  1. Load CSV via propertyUrlResolver                       │ │
│  │  2. Initialize Browser Pool via browserPoolManager         │ │
│  │  3. Distribute properties to 5 browsers                    │ │
│  │  4. For each property:                                     │ │
│  │     - Acquire browser from pool                            │ │
│  │     - Navigate to property URL                             │ │
│  │     - Capture network events via networkEventCapturer      │ │
│  │     - Validate config via configValidator                  │ │
│  │     - Save results via resultStorage                       │ │
│  │     - Send alerts if issues found                          │ │
│  │     - Release browser to pool                              │ │
│  │  5. Cleanup: Close browsers, Delete old files              │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Module Architecture

### 1. orchestrator (Main Execution Logic)

**책임**:
- 전체 검증 워크플로우 조율
- 브라우저 풀 초기화 및 속성 분배
- 병렬 실행 관리 및 에러 핸들링
- 실행 시작/종료 로깅

**주요 함수**:
```javascript
// Main entry point
async function main() {
  // 1. Load properties from CSV
  // 2. Initialize browser pool
  // 3. Distribute properties to workers
  // 4. Execute validation in parallel
  // 5. Cleanup and report
}

// Validate single property
async function validateProperty(browser, property) {
  // 1. Navigate to URL
  // 2. Capture network events
  // 3. Validate configuration
  // 4. Save results
  // 5. Send alerts if needed
}

// Retry logic for transient errors
async function retryWithBackoff(fn, maxRetries = 3) {
  // Exponential backoff: 1s, 2s, 4s
}
```

**의존성**:
- `browserPoolManager`: 브라우저 풀 관리
- `propertyUrlResolver`: CSV 파싱
- `networkEventCapturer`: 네트워크 감청
- `configValidator`: 설정 검증
- `resultStorage`: 결과 저장

**에러 처리**:
- 치명적 오류(CSV 없음, 브라우저 초기화 실패) → Slack 긴급 알림 + 프로세스 종료
- 일시적 오류(네트워크 타임아웃, 사이트 다운) → 최대 3회 재시도
- 설정 오류(측정 ID 불일치) → 즉시 이슈 기록 및 다음 속성 진행

---

### 2. browserPoolManager (Browser Pool Management)

**책임**:
- Playwright 브라우저 풀 생성 및 관리
- 브라우저 할당(acquire) 및 반환(release)
- 브라우저 리소스 모니터링 및 정리

**주요 함수**:
```javascript
// Initialize browser pool with 5 Chromium instances
async function initBrowserPool(poolSize = 5) {
  // Create 5 browser instances with stealth mode
  // Configure User-Agent, viewport, etc.
  // Return browser pool array
}

// Acquire available browser from pool
async function acquireBrowser() {
  // Wait for available browser
  // Mark browser as in-use
  // Return browser instance
}

// Release browser back to pool
async function releaseBrowser(browser) {
  // Clear browser context (cookies, cache, etc.)
  // Mark browser as available
  // Log browser usage stats
}

// Close all browsers in pool
async function closeBrowserPool() {
  // Close all browser instances
  // Clear pool array
  // Log total usage stats
}
```

**브라우저 설정**:
```javascript
{
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-blink-features=AutomationControlled'
  ],
  ignoreDefaultArgs: ['--enable-automation'],
  viewport: { width: 1920, height: 1080 },
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...'
}
```

**리소스 관리**:
- 브라우저당 최대 500MB 메모리 제한
- 컨텍스트 초기화로 속성 간 상태 오염 방지
- 브라우저 재사용으로 초기화 오버헤드 감소

---

### 3. networkEventCapturer (CDP Network Event Capture)

**책임**:
- Chrome DevTools Protocol 활성화
- 네트워크 요청 감청 및 필터링
- GA4 이벤트 파라미터 파싱 및 추출

**주요 함수**:
```javascript
// Enable CDP and start capturing network events
async function startCapturing(page) {
  // Enable CDP Network domain
  // Set up event listeners for Request events
  // Filter for analytics.google.com/g/collect
  // Store captured events
}

// Extract measurement ID from GA4 event
function extractMeasurementId(requestUrl) {
  // Parse URL parameters
  // Extract 'tid' parameter (tracking ID / measurement ID)
  // Return measurement ID (G-XXXXXXXXX)
}

// Extract event name from GA4 event
function extractEventName(requestUrl) {
  // Parse URL parameters
  // Extract 'en' parameter (event name)
  // Return event name (e.g., 'page_view')
}

// Wait for GA4 events with timeout
async function waitForGA4Events(page, timeout = 10000) {
  // Wait up to 10 seconds for GA4 events
  // Return array of captured events
}
```

**네트워크 이벤트 구조**:
```javascript
{
  url: 'https://analytics.google.com/g/collect?tid=G-XXXXXXXXX&en=page_view&...',
  method: 'POST',
  headers: { ... },
  timestamp: 1698765432000,
  measurementId: 'G-XXXXXXXXX',
  eventName: 'page_view'
}
```

**성능 최적화**:
- 불필요한 리소스(이미지, CSS, 폰트) 로딩 차단으로 속도 향상
- GA4 이벤트만 필터링하여 메모리 사용량 감소

---

### 4. propertyUrlResolver (CSV Parsing & URL Resolution)

**책임**:
- CSV 파일 읽기 및 파싱
- 속성 메타데이터 추출 및 검증
- 속성 목록 변경 감지 및 로깅

**주요 함수**:
```javascript
// Load properties from CSV file
async function loadProperties(csvPath) {
  // Read CSV file with UTF-8 encoding
  // Parse CSV using csv-parser
  // Validate required fields (measurement ID, URL)
  // Return array of Property objects
}

// Validate property metadata
function validatePropertyMetadata(property) {
  // Check required fields: measurementId, url
  // Validate measurement ID format (G-XXXXXXXXX)
  // Validate GTM ID format (GTM-XXXXXXXX)
  // Validate URL format
  // Return validation result
}

// Detect property changes (added/removed)
function detectPropertyChanges(oldProperties, newProperties) {
  // Compare property lists by measurement ID
  // Return { added: [], removed: [] }
}
```

**CSV 컬럼 매핑** (via `csvColumnNames` module):
```javascript
const COLUMN_NAMES = {
  ACCOUNT_NAME: '계정명',
  PROPERTY_NAME: '속성명',
  MEASUREMENT_ID: 'WebStream Measurement ID',
  SITE_TYPE: '사이트 유형',
  REPRESENTATIVE_URL: '대표 URLs',
  WEB_APP_TYPE: '웹/앱 여부',
  WEB_GTM_ID: 'Web GTM Public ID',
  ANDROID_GTM_ID: 'Android GTM Public ID',
  IOS_GTM_ID: 'iOS GTM Public ID',
  DATASET_ID: 'Dataset ID',
  MARKETING_GTM: '마케팅 GTM',
  WHITELIST: 'whitelist'
};
```

**에러 처리**:
- CSV 파일 없음 → 치명적 오류, 프로세스 종료
- CSV 파싱 오류 → 치명적 오류, 상세 에러 메시지 로그
- 필수 필드 누락 → 경고 로그, 해당 행 건너뛰기

---

### 5. configValidator (GA4/GTM Configuration Validation)

**책임**:
- 측정 ID 검증 (기대값 vs 실제값)
- GTM 컨테이너 ID 검증
- page_view 이벤트 발생 확인
- AP_DATA 환경변수 추출

**주요 함수**:
```javascript
// Validate measurement ID
function validateMeasurementId(capturedEvents, expectedMeasurementId) {
  // Extract measurement ID from captured GA4 events
  // Compare with expected value from CSV
  // Return { isValid: boolean, actualId: string, issues: [] }
}

// Validate GTM container ID
async function validateGTMId(page, expectedGtmId) {
  // Search for GTM script tag in page HTML
  // Extract GTM container ID using regex
  // Compare with expected value from CSV
  // Return { isValid: boolean, actualId: string, issues: [] }
}

// Validate page_view event
function validatePageViewEvent(capturedEvents) {
  // Search for 'page_view' event in captured events
  // Return { isValid: boolean, count: number, issues: [] }
}

// Extract AP_DATA from page
async function extractAPData(page) {
  // Search for window.AP_DATA global variable
  // Search for AP_DATA in data layer
  // Return AP_DATA object or null
}

// Comprehensive validation
async function validateProperty(page, capturedEvents, property) {
  // Run all validation checks
  // Aggregate issues
  // Return ValidationResult object
}
```

**정규식 패턴**:
```javascript
// GTM script tag pattern
const GTM_PATTERN = /GTM-[A-Z0-9]{6,}/;

// Measurement ID pattern
const MEASUREMENT_ID_PATTERN = /G-[A-Z0-9]{10}/;
```

---

### 6. resultStorage (Result Storage & Screenshot Management)

**책임**:
- 검증 결과 JSON 저장
- fullPage 스크린샷 캡처 및 저장
- 30일 경과 데이터 자동 삭제
- Slack 알림 발송

**주요 함수**:
```javascript
// Save validation result as JSON
async function saveValidationResult(result, date) {
  // Create date folder (results/YYYY-MM-DD/)
  // Save result as JSON with pretty print
  // Return JSON file path
}

// Capture and save screenshot
async function saveScreenshot(page, propertyName, date) {
  // Create date folder (screenshots/YYYY-MM-DD/)
  // Capture fullPage screenshot
  // Save with filename: property-name_YYYYMMDD-HHmmss.png
  // Return screenshot file path
}

// Delete files older than 30 days
async function cleanupOldFiles(basePath, retentionDays = 30) {
  // Find folders older than 30 days
  // Delete all files in those folders
  // Log deleted folder/file counts
}

// Send Slack alert
async function sendSlackAlert(result) {
  // Load Slack Webhook URL from env
  // Format message with Slack Markdown
  // Include property name, issue type, timestamp, screenshot path
  // POST to Slack Webhook
  // Log success/failure
}
```

**폴더 구조**:
```
ga4TechIssueCatcher/
├── results/
│   ├── 2025-01-15/
│   │   ├── amoremall-kr.json
│   │   ├── innisfree-us.json
│   │   └── ...
│   ├── 2025-01-16/
│   └── ...
├── screenshots/
│   ├── 2025-01-15/
│   │   ├── amoremall-kr_20250115-030512.png
│   │   ├── innisfree-us_20250115-030845.png
│   │   └── ...
│   ├── 2025-01-16/
│   └── ...
└── logs/
    ├── 2025-01-15.log
    ├── 2025-01-16.log
    └── ...
```

**Slack 메시지 포맷**:
```markdown
🚨 *GA4 Tech Issue Detected*

*Property*: AMOREMALL KR
*Issue Type*: Measurement ID Mismatch
*Expected*: G-ABC1234567
*Actual*: G-XYZ9876543
*Timestamp*: 2025-01-15 03:05:12 KST
*Screenshot*: screenshots/2025-01-15/amoremall-kr_20250115-030512.png

Please investigate and fix the issue.
```

---

### 7. csvColumnNames (CSV Column Name Constants)

**책임**:
- CSV 컬럼명 상수 정의
- 컬럼명 변경 시 단일 위치 수정

**구조**:
```javascript
// csvColumnNames.js
export const COLUMN_NAMES = {
  ACCOUNT_NAME: '계정명',
  PROPERTY_NAME: '속성명',
  MEASUREMENT_ID: 'WebStream Measurement ID',
  SITE_TYPE: '사이트 유형',
  REPRESENTATIVE_URL: '대표 URLs',
  WEB_APP_TYPE: '웹/앱 여부',
  WEB_GTM_ID: 'Web GTM Public ID',
  ANDROID_GTM_ID: 'Android GTM Public ID',
  IOS_GTM_ID: 'iOS GTM Public ID',
  DATASET_ID: 'Dataset ID',
  MARKETING_GTM: '마케팅 GTM',
  WHITELIST: 'whitelist'
};

// Helper function to get column value
export function getColumnValue(row, columnKey) {
  const columnName = COLUMN_NAMES[columnKey];
  return row[columnName];
}
```

---

## Data Flow

### End-to-End Validation Flow

```
1. Cron Trigger (Daily 3AM)
   ↓
2. orchestrator.main()
   ↓
3. propertyUrlResolver.loadProperties()
   → Read CSV file
   → Parse and validate metadata
   → Return Property[] array
   ↓
4. browserPoolManager.initBrowserPool()
   → Launch 5 Chromium browsers
   → Configure stealth mode
   → Return Browser[] pool
   ↓
5. Distribute 100 properties to 5 browsers (20 each)
   ↓
6. For each property (in parallel):
   ↓
   6a. browserPoolManager.acquireBrowser()
       → Get available browser from pool
   ↓
   6b. Navigate to property URL
   ↓
   6c. networkEventCapturer.startCapturing()
       → Enable CDP Network domain
       → Listen for analytics.google.com requests
   ↓
   6d. networkEventCapturer.waitForGA4Events(10s)
       → Wait for GA4 events
       → Extract measurement ID, event names
   ↓
   6e. configValidator.validateProperty()
       → Validate measurement ID
       → Validate GTM ID
       → Validate page_view event
       → Extract AP_DATA
       → Aggregate issues
   ↓
   6f. resultStorage.saveScreenshot()
       → Capture fullPage screenshot
       → Save to screenshots/YYYY-MM-DD/
   ↓
   6g. resultStorage.saveValidationResult()
       → Save validation result JSON
       → Save to results/YYYY-MM-DD/
   ↓
   6h. If issues found:
       resultStorage.sendSlackAlert()
       → Format Slack message
       → POST to Slack Webhook
   ↓
   6i. browserPoolManager.releaseBrowser()
       → Clear browser context
       → Return to pool
   ↓
7. browserPoolManager.closeBrowserPool()
   → Close all browsers
   → Log total stats
   ↓
8. resultStorage.cleanupOldFiles()
   → Delete files older than 30 days
   ↓
9. Log execution summary
   → Total properties processed
   → Success/failure counts
   → Execution time
```

### Data Transformation Pipeline

```
CSV Row (Raw)
  ↓ propertyUrlResolver
Property Object
  ↓ networkEventCapturer
Network Events Array
  ↓ configValidator
ValidationResult Object
  ↓ resultStorage
JSON File + Screenshot + Slack Alert
```

---

## Data Models

### Property

속성 메타데이터를 나타내는 객체

```typescript
interface Property {
  accountName: string;          // 계정명 (e.g., "AMOREMALL")
  propertyName: string;         // 속성명 (e.g., "AMOREMALL KR")
  measurementId: string;        // GA4 측정 ID (e.g., "G-ABC1234567")
  siteType: string;             // 사이트 유형 (e.g., "Ecommerce")
  representativeUrl: string;    // 대표 URL (e.g., "https://www.amoremall.com")
  webAppType: string;           // 웹/앱 여부 (e.g., "Web")
  webGtmId: string;             // Web GTM ID (e.g., "GTM-XXXXXXXX")
  androidGtmId?: string;        // Android GTM ID (optional)
  iosGtmId?: string;            // iOS GTM ID (optional)
  datasetId?: string;           // Dataset ID (optional)
  marketingGtm?: string;        // 마케팅 GTM (optional)
  whitelist?: string[];         // Whitelist 도메인 배열 (optional)
}
```

### NetworkEvent

캡처된 네트워크 이벤트

```typescript
interface NetworkEvent {
  url: string;                  // 요청 URL
  method: string;               // HTTP 메서드 (e.g., "POST")
  headers: Record<string, string>; // 요청 헤더
  timestamp: number;            // Unix timestamp (ms)
  measurementId?: string;       // 추출된 측정 ID
  eventName?: string;           // 추출된 이벤트명 (e.g., "page_view")
}
```

### ValidationResult

검증 결과 객체

```typescript
interface ValidationResult {
  propertyName: string;         // 속성명
  validationTime: string;       // 검증 시간 (ISO 8601)
  url: string;                  // 검증된 URL

  // Measurement ID 검증
  measurementId: {
    expected: string;           // 기대 측정 ID
    actual?: string;            // 실제 측정 ID
    isValid: boolean;           // 일치 여부
  };

  // GTM ID 검증
  gtmId: {
    expected: string;           // 기대 GTM ID
    actual?: string;            // 실제 GTM ID
    isValid: boolean;           // 일치 여부
  };

  // page_view 이벤트 검증
  pageViewEvent: {
    isValid: boolean;           // 발생 여부
    count: number;              // 발생 횟수
  };

  // AP_DATA 추출
  apData?: Record<string, any>; // AP_DATA 객체 (optional)

  // 이슈 목록
  issues: IssueReport[];        // 발견된 이슈 배열

  // 스크린샷 경로
  screenshotPath: string;       // 상대 경로 (e.g., "screenshots/2025-01-15/amoremall-kr_20250115-030512.png")

  // 메타데이터
  retryCount: number;           // 재시도 횟수
  executionTimeMs: number;      // 검증 실행 시간 (ms)
}
```

### IssueReport

발견된 이슈 보고서

```typescript
interface IssueReport {
  type: IssueType;              // 이슈 유형
  severity: 'critical' | 'warning' | 'info'; // 심각도
  message: string;              // 이슈 메시지
  expected?: string;            // 기대값 (optional)
  actual?: string;              // 실제값 (optional)
  timestamp: string;            // 발견 시간 (ISO 8601)
}

enum IssueType {
  MEASUREMENT_ID_MISMATCH = 'measurement_id_mismatch',
  MEASUREMENT_ID_NOT_FOUND = 'measurement_id_not_found',
  GTM_ID_MISMATCH = 'gtm_id_mismatch',
  GTM_NOT_FOUND = 'gtm_not_found',
  PAGE_VIEW_NOT_FOUND = 'page_view_not_found',
  NETWORK_TIMEOUT = 'network_timeout',
  SITE_DOWN = 'site_down',
  UNKNOWN_ERROR = 'unknown_error'
}
```

---

## API Interfaces

### orchestrator

```typescript
// Main entry point
async function main(): Promise<void>

// Validate single property with retry logic
async function validateProperty(
  browser: Browser,
  property: Property
): Promise<ValidationResult>

// Retry logic with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3
): Promise<T>
```

### browserPoolManager

```typescript
// Initialize browser pool
async function initBrowserPool(
  poolSize: number = 5
): Promise<Browser[]>

// Acquire available browser
async function acquireBrowser(): Promise<Browser>

// Release browser back to pool
async function releaseBrowser(browser: Browser): Promise<void>

// Close all browsers
async function closeBrowserPool(): Promise<void>
```

### networkEventCapturer

```typescript
// Start capturing network events
async function startCapturing(page: Page): Promise<void>

// Wait for GA4 events with timeout
async function waitForGA4Events(
  page: Page,
  timeout: number = 10000
): Promise<NetworkEvent[]>

// Extract measurement ID from URL
function extractMeasurementId(url: string): string | null

// Extract event name from URL
function extractEventName(url: string): string | null
```

### propertyUrlResolver

```typescript
// Load properties from CSV
async function loadProperties(
  csvPath: string
): Promise<Property[]>

// Validate property metadata
function validatePropertyMetadata(
  property: Property
): { isValid: boolean; errors: string[] }

// Detect property changes
function detectPropertyChanges(
  oldProperties: Property[],
  newProperties: Property[]
): { added: Property[]; removed: Property[] }
```

### configValidator

```typescript
// Validate measurement ID
function validateMeasurementId(
  capturedEvents: NetworkEvent[],
  expectedMeasurementId: string
): {
  isValid: boolean;
  actualId?: string;
  issues: IssueReport[];
}

// Validate GTM ID
async function validateGTMId(
  page: Page,
  expectedGtmId: string
): Promise<{
  isValid: boolean;
  actualId?: string;
  issues: IssueReport[];
}>

// Validate page_view event
function validatePageViewEvent(
  capturedEvents: NetworkEvent[]
): {
  isValid: boolean;
  count: number;
  issues: IssueReport[];
}

// Extract AP_DATA
async function extractAPData(
  page: Page
): Promise<Record<string, any> | null>

// Comprehensive validation
async function validateProperty(
  page: Page,
  capturedEvents: NetworkEvent[],
  property: Property
): Promise<ValidationResult>
```

### resultStorage

```typescript
// Save validation result
async function saveValidationResult(
  result: ValidationResult,
  date: string
): Promise<string>

// Save screenshot
async function saveScreenshot(
  page: Page,
  propertyName: string,
  date: string
): Promise<string>

// Cleanup old files
async function cleanupOldFiles(
  basePath: string,
  retentionDays: number = 30
): Promise<{ deletedFolders: number; deletedFiles: number }>

// Send Slack alert
async function sendSlackAlert(
  result: ValidationResult
): Promise<void>
```

---

## Deployment Architecture

### Server Specification

```yaml
Hardware:
  CPU: 4 cores (minimum)
  RAM: 8GB (minimum)
  Storage: 100GB (SSD recommended)

Software:
  OS: Ubuntu 20.04 LTS or higher
  Runtime: Node.js 18 LTS
  Browser: Chromium (via Playwright)

Network:
  Location: Internal corporate network
  Internet: Required for GA4/GTM validation
  Firewall: Whitelist analytics.google.com, Slack API
```

### Directory Structure

```
/opt/ga4-tech-issue-catcher/
├── src/
│   ├── orchestrator/
│   ├── browserPoolManager/
│   ├── networkEventCapturer/
│   ├── propertyUrlResolver/
│   ├── configValidator/
│   ├── resultStorage/
│   └── csvColumnNames/
├── tests/
│   ├── unit/
│   └── e2e/
├── results/          # Validation results (JSON)
├── screenshots/      # Full-page screenshots
├── logs/             # System logs
├── src/ga4Property/
│   └── Amore_GA4_PropertList.csv
├── .env              # Environment variables (not in git)
├── .env.example      # Example environment file
├── package.json
├── package-lock.json
└── README.md
```

### Cron Job Configuration

```bash
# Edit crontab
crontab -e

# Add daily execution at 3AM
0 3 * * * cd /opt/ga4-tech-issue-catcher && /usr/bin/node src/orchestrator/index.js >> logs/cron.log 2>&1
```

### Environment Variables

```bash
# .env file
NODE_ENV=production
LOG_LEVEL=info

# Slack Configuration
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/XXX/YYY/ZZZ

# Browser Pool Configuration
BROWSER_POOL_SIZE=5
BROWSER_HEADLESS=true

# Validation Configuration
NETWORK_TIMEOUT_MS=10000
MAX_RETRIES=3
RETRY_BACKOFF_MS=1000

# Storage Configuration
RESULTS_BASE_PATH=/opt/ga4-tech-issue-catcher/results
SCREENSHOTS_BASE_PATH=/opt/ga4-tech-issue-catcher/screenshots
RETENTION_DAYS=30

# CSV Configuration
CSV_PATH=/opt/ga4-tech-issue-catcher/src/ga4Property/Amore_GA4_PropertList.csv
```

---

## Technology Stack

### Runtime & Core Libraries

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| Runtime | Node.js | 18 LTS | JavaScript runtime |
| Module System | ES Modules | - | Modern module syntax |
| Browser Automation | Playwright | ^1.40.0 | Chromium automation |
| CSV Parsing | csv-parser | ^3.0.0 | CSV file parsing |
| HTTP Client | node-fetch | ^3.3.0 | Slack Webhook calls |
| Logging | winston | ^3.11.0 | Structured logging |

### Development Tools

| Category | Technology | Purpose |
|----------|-----------|---------|
| Linter | ESLint | Code quality |
| Formatter | Prettier | Code formatting |
| Testing | Playwright Test | E2E testing |
| Version Control | Git | Source control |

### External Services

| Service | Purpose |
|---------|---------|
| Google Analytics 4 | GA4 event validation target |
| Google Tag Manager | GTM configuration validation target |
| Slack Incoming Webhooks | Alert notifications |

---

## Security Architecture

### Data Security

**Sensitive Data**:
- Slack Webhook URL: 환경변수(.env)로 관리, .gitignore 추가
- 검증 결과 JSON: 사내 네트워크 내부 저장, 팀 전용 권한 설정
- 스크린샷: 민감한 사용자 정보 포함 가능, 30일 자동 삭제

**파일 권한**:
```bash
# Results and screenshots: Read/Write for analytics team only
chmod 750 results/ screenshots/
chown analytics-team:analytics-team results/ screenshots/

# .env file: Read-only for application user
chmod 400 .env
chown ga4-catcher-app:ga4-catcher-app .env
```

### Network Security

**방화벽 규칙**:
```
Outbound (허용):
- analytics.google.com (HTTPS/443): GA4 이벤트 검증
- googletagmanager.com (HTTPS/443): GTM 스크립트 검증
- hooks.slack.com (HTTPS/443): 알림 발송

Inbound (차단):
- 모든 외부 연결 차단 (내부 네트워크만 허용)
```

### Application Security

**Input Validation**:
- CSV 파일: 파일 존재 확인, UTF-8 인코딩 검증
- 속성 URL: URL 형식 검증, whitelist 도메인만 허용
- 환경변수: 필수 변수 존재 확인, 형식 검증

**Error Handling**:
- 상세 에러 메시지 로그 기록 (내부 전용)
- Slack 알림에는 민감 정보 제외 (스택 트레이스 미포함)

---

## Performance & Scalability

### Performance Targets

| Metric | Target | Current | Notes |
|--------|--------|---------|-------|
| Total Validation Time | < 2 hours | ~1.5 hours | 100 properties, 5 browsers |
| Property Validation Time | < 90 seconds | ~60 seconds | Average per property |
| Memory Usage | < 3GB | ~2.5GB | All 5 browsers + Node.js |
| Browser Memory | < 500MB | ~400MB | Per browser instance |
| False Positive Rate | < 5% | TBD | To be measured in production |
| False Negative Rate | < 5% | TBD | To be measured in production |

### Scalability Strategy

**수평 확장 (Horizontal Scaling)**:
```
Current: 100 properties, 5 browsers, 2 hours
  ↓
Target: 130 properties (30% increase)
  ↓
Solution: 7 browsers, 2 hours (same time)
  ↓
Calculation: 130 properties / 7 browsers ≈ 18.5 properties per browser
            18.5 * 60 seconds ≈ 1,110 seconds ≈ 18.5 minutes per browser
            Total time ≈ 18.5 minutes (parallel execution)
```

**수직 확장 (Vertical Scaling)**:
- CPU 증가 → 브라우저 수 증가 가능 (8 core → 10 browsers)
- RAM 증가 → 브라우저당 메모리 제한 완화 (16GB → 브라우저당 1GB)

### Performance Optimization

**리소스 최적화**:
- 불필요한 리소스 로딩 차단 (이미지, CSS, 폰트)
- 브라우저 컨텍스트 재사용 (풀 관리)
- 결과 파일 압축 (JSON gzip, PNG 최적화)

**병렬 처리**:
- 속성 분배 알고리즘: Round-robin 방식으로 균등 분배
- 브라우저 간 독립 실행: 한 브라우저 오류가 다른 브라우저에 영향 없음

**캐싱 전략**:
- 브라우저 풀 재사용으로 초기화 시간 단축
- CSV 파일 한 번 로드 후 메모리에서 재사용

---

## Appendix

### Glossary

| Term | Definition |
|------|------------|
| **GA4** | Google Analytics 4 - 구글의 차세대 웹 분석 플랫폼 |
| **GTM** | Google Tag Manager - 태그 관리 시스템 |
| **CDP** | Chrome DevTools Protocol - Chrome 브라우저 자동화 프로토콜 |
| **Measurement ID** | GA4 속성 식별자 (G-XXXXXXXXX 형식) |
| **GTM Container ID** | GTM 컨테이너 식별자 (GTM-XXXXXXXX 형식) |
| **page_view** | GA4의 기본 페이지뷰 이벤트 |
| **AP_DATA** | Amorepacific 특화 환경변수 |
| **Playwright** | Microsoft의 브라우저 자동화 프레임워크 |
| **Stealth Mode** | Bot detection 우회를 위한 브라우저 설정 |
| **Browser Pool** | 재사용 가능한 브라우저 인스턴스 집합 |
| **Idempotent** | 동일한 작업을 여러 번 수행해도 결과가 동일한 성질 |

### References

- [Playwright Documentation](https://playwright.dev/)
- [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/)
- [Google Analytics 4 Measurement Protocol](https://developers.google.com/analytics/devguides/collection/protocol/ga4)
- [Slack Incoming Webhooks](https://api.slack.com/messaging/webhooks)
- [Node.js 18 LTS Documentation](https://nodejs.org/docs/latest-v18.x/api/)

---

**Document Version**: 1.0
**Last Updated**: 2025-10-29
**Author**: Mary (Business Analyst)
**Status**: ✅ Completed
