# Supabase 설정 가이드

이 문서는 GA4 Tech Issue Catcher 프로젝트에 Supabase를 설정하는 방법을 안내합니다.

## 1. Supabase 프로젝트 생성

1. [Supabase Dashboard](https://app.supabase.com)에 접속
2. "New Project" 클릭
3. 프로젝트 정보 입력:
   - **Project Name**: ga4-tech-issue-catcher
   - **Database Password**: 강력한 비밀번호 설정
   - **Region**: 가장 가까운 지역 선택 (e.g., Northeast Asia - Seoul)
4. "Create new project" 클릭

## 2. 데이터베이스 스키마 생성

프로젝트가 생성되면:

1. 왼쪽 메뉴에서 **SQL Editor** 클릭
2. `supabase/migrations/001_initial_schema.sql` 파일 내용 전체 복사
3. SQL Editor에 붙여넣기
4. **Run** 버튼 클릭

다음 테이블이 생성됩니다:
- ✅ `properties` - 크롤링할 프로퍼티 정보
- ✅ `crawl_runs` - 크롤링 실행 이력
- ✅ `crawl_results` - 개별 결과
- ✅ `property_status_history` - 상태 변경 이력

## 3. API 키 확인

1. 왼쪽 메뉴에서 **Project Settings** > **API** 클릭
2. 다음 정보를 복사:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public** 키
   - **service_role** 키 (백엔드용, 주의: 비밀로 유지!)

## 4. 환경 변수 설정

프로젝트 루트에 `.env` 파일 생성 (또는 기존 파일에 추가):

```bash
# Supabase Configuration
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Existing configuration
CSV_PATH=./src/ga4Property/Amore_GA4_PropertList.csv
BROWSER_POOL_SIZE=7
RETENTION_DAYS=30
SERVER_PORT=3000
```

⚠️ **보안 주의사항**:
- `.env` 파일은 절대 Git에 커밋하지 마세요
- `service_role` 키는 서버 사이드에서만 사용
- `anon` 키는 프론트엔드에서 사용 가능

## 5. 의존성 설치

```bash
npm install @supabase/supabase-js
```

## 6. 초기 데이터 임포트 (선택사항)

기존 CSV 파일에서 Supabase로 프로퍼티 데이터를 임포트:

```bash
node scripts/import-properties-to-supabase.js
```

이 스크립트는 자동으로 생성될 예정입니다.

## 7. 연결 확인

서버 시작 후 다음 URL로 연결 확인:

```bash
npm start
curl http://localhost:3000/api/status
```

응답에 Supabase 연결 상태가 포함되어야 합니다.

## 테이블 스키마 상세

### properties
```sql
- id: UUID (PK)
- property_name: TEXT
- url: TEXT (UNIQUE)
- slug: TEXT (UNIQUE)
- expected_ga4_id: TEXT
- expected_gtm_id: TEXT
- current_status: TEXT ('normal', 'issue', 'debugging')
- brand: TEXT
- region: TEXT
- is_active: BOOLEAN
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
```

### crawl_runs
```sql
- id: UUID (PK)
- run_date: DATE
- status: TEXT ('running', 'completed', 'failed', 'cancelled')
- total_properties: INTEGER
- completed_properties: INTEGER
- failed_properties: INTEGER
- properties_with_issues: INTEGER
- browser_pool_size: INTEGER
- started_at: TIMESTAMPTZ
- completed_at: TIMESTAMPTZ
- duration_seconds: INTEGER
- error_message: TEXT
```

### crawl_results
```sql
- id: UUID (PK)
- crawl_run_id: UUID (FK)
- property_id: UUID (FK)
- validation_status: TEXT ('passed', 'failed', 'error')
- collected_ga4_id: TEXT
- collected_gtm_id: TEXT
- page_view_event_detected: BOOLEAN
- has_issues: BOOLEAN
- issue_types: TEXT[]
- issue_summary: TEXT
- screenshot_path: TEXT
- screenshot_url: TEXT
- validation_duration_ms: INTEGER
- phase: INTEGER
```

### property_status_history
```sql
- id: UUID (PK)
- property_id: UUID (FK)
- previous_status: TEXT
- new_status: TEXT
- change_reason: TEXT
- changed_by: TEXT
- related_crawl_run_id: UUID (FK, nullable)
- notes: TEXT
- changed_at: TIMESTAMPTZ
```

## 추가 기능

### Row Level Security (RLS)
모든 테이블에 RLS가 활성화되어 있습니다. 현재는 모든 사용자가 접근 가능하도록 설정되어 있으며, 필요시 정책을 수정할 수 있습니다.

### 자동 타임스탬프
- `properties`와 `crawl_runs`는 자동으로 `updated_at` 업데이트
- `property_status_history`는 상태 변경 시 자동으로 레코드 생성

## 문제 해결

### 연결 오류
```
Error: Failed to connect to Supabase
```
→ `.env` 파일의 `SUPABASE_URL`과 키를 확인하세요

### 마이그레이션 실패
```
ERROR: relation "properties" already exists
```
→ 이미 테이블이 존재합니다. SQL Editor에서 기존 테이블 삭제 후 재실행

### RLS 정책 오류
```
ERROR: new row violates row-level security policy
```
→ SQL Editor에서 RLS 정책을 확인하고 필요시 수정

## 다음 단계

1. ✅ Supabase 프로젝트 생성
2. ✅ 스키마 마이그레이션 실행
3. ✅ 환경 변수 설정
4. 🔄 백엔드 API 연동 (진행 중)
5. 🔄 프론트엔드 통합 (진행 중)
