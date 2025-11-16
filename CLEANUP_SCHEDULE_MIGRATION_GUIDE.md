# Cleanup Schedule Migration Guide
## .env → Database 마이그레이션 완료 가이드

**작성일**: 2025-11-03
**마이그레이션 버전**: 003_add_cleanup_settings.sql
**백업 파일**: ga4TechIssueCatcher-backup-20251103-140532.tar.gz (7.9GB)

---

## 📋 목차
1. [마이그레이션 개요](#마이그레이션-개요)
2. [마이그레이션 실행 방법](#마이그레이션-실행-방법)
3. [서버 재시작 및 테스트](#서버-재시작-및-테스트)
4. [이슈 발생 시 복구 방법](#이슈-발생-시-복구-방법)
5. [문제 해결 가이드](#문제-해결-가이드)

---

## 🎯 마이그레이션 개요

### 변경 사항 요약
- **Before**: `.env` 파일의 `CLEANUP_CRON` 환경변수 사용
- **After**: Supabase `cleanup_settings` 테이블에서 설정 관리

### 영향받는 파일
```
✅ supabase/migrations/003_add_cleanup_settings.sql (NEW)
✅ src/utils/cleanupScheduler.js (MODIFIED)
✅ src/routes/cleanup.js (MODIFIED)
✅ .env (MODIFIED - 주석 처리)
```

### 주요 기능
- 데이터베이스 기반 스케줄 설정
- 타임존 지원 (Asia/Seoul)
- 동적 스케줄 변경 (재시작 불필요)
- 실행 이력 추적 (last_run_at, next_run_at)

---

## 🚀 마이그레이션 실행 방법

### Step 1: Supabase 콘솔에서 마이그레이션 실행

#### 방법 A: Supabase Dashboard (권장)
1. https://supabase.com/dashboard 접속
2. 프로젝트 선택: `vmezpiybidirjxkehwer`
3. SQL Editor 열기
4. 마이그레이션 파일 내용 복사 붙여넣기

**마이그레이션 SQL**: `supabase/migrations/003_add_cleanup_settings.sql`

```sql
-- 마이그레이션 파일 내용을 여기에 붙여넣고 실행하세요
-- 파일 위치: /Users/seong-won-yeong/Dev/ga4TechIssueCatcher/supabase/migrations/003_add_cleanup_settings.sql
```

5. "Run" 버튼 클릭하여 실행
6. 결과 확인: "Migration complete" 메시지

#### 방법 B: Supabase CLI (로컬 개발)
```bash
# Supabase 프로젝트 연결
npx supabase link --project-ref vmezpiybidirjxkehwer

# 마이그레이션 실행
npx supabase db push

# 또는 직접 SQL 실행
npx supabase db execute -f supabase/migrations/003_add_cleanup_settings.sql
```

### Step 2: 마이그레이션 검증

#### 테이블 생성 확인
```sql
-- Supabase Dashboard SQL Editor에서 실행
SELECT * FROM cleanup_settings;
```

**기대 결과**:
```
id: [UUID]
cron_expression: '0 3 * * *'
timezone: 'Asia/Seoul'
is_enabled: true
unsaved_crawl_ttl_days: 30
screenshot_ttl_days: 30
batch_size: 100
last_run_at: null
next_run_at: null
created_at: [timestamp]
updated_at: [timestamp]
```

---

## 🔄 서버 재시작 및 테스트

### Step 1: 기존 서버 중지
```bash
# 포트 3000에서 실행중인 프로세스 종료
lsof -ti:3000 | xargs kill -9

# 또는 pm2 사용 시
pm2 stop all
```

### Step 2: 서버 재시작
```bash
cd /Users/seong-won-yeong/Dev/ga4TechIssueCatcher
npm run server
```

### Step 3: 시작 로그 확인
**정상 동작 로그 예시**:
```
[INFO] Cleanup settings loaded from database
  cronExpression: 0 3 * * *
  timezone: Asia/Seoul
  isEnabled: true

============================================================
⏰ Starting Automatic Cleanup Scheduler
============================================================
Cron Expression: 0 3 * * *
Timezone: Asia/Seoul
============================================================

✅ Cleanup scheduler started
   Next run: 2025-11-04 03:00:00
```

**에러 로그 예시** (마이그레이션 미실행):
```
[WARN] Cleanup settings not found, using defaults
  code: PGRST116
  message: The result contains 0 rows
```

### Step 4: API 엔드포인트 테스트

#### 현재 설정 조회
```bash
curl http://localhost:3000/api/cleanup/schedule
```

**기대 응답**:
```json
{
  "success": true,
  "data": {
    "id": "...",
    "cron_expression": "0 3 * * *",
    "timezone": "Asia/Seoul",
    "is_enabled": true,
    "unsaved_crawl_ttl_days": 30,
    "screenshot_ttl_days": 30,
    "batch_size": 100,
    "last_run_at": null,
    "next_run_at": null
  }
}
```

#### 스케줄 변경 테스트
```bash
curl -X POST http://localhost:3000/api/cleanup/schedule \
  -H "Content-Type: application/json" \
  -d '{
    "cronExpression": "0 2 * * *",
    "timezone": "Asia/Seoul",
    "enabled": true
  }'
```

**기대 응답**:
```json
{
  "success": true,
  "message": "Cleanup schedule updated successfully",
  "data": {
    "id": "...",
    "cron_expression": "0 2 * * *",
    "timezone": "Asia/Seoul",
    "is_enabled": true
  }
}
```

### Step 5: 스케줄러 상태 확인
```bash
curl http://localhost:3000/api/cleanup/status
```

**기대 응답**:
```json
{
  "success": true,
  "data": {
    "isRunning": false,
    "lastCleanup": null,
    "config": {
      "unsavedCrawlTTL": 30,
      "screenshotTTL": 30,
      "batchSize": 100
    }
  }
}
```

---

## 🔧 이슈 발생 시 복구 방법

### 문제 1: 서버가 시작되지 않음
**증상**: "cleanup_settings table does not exist" 에러

**원인**: 마이그레이션이 실행되지 않음

**복구 방법**:
1. Supabase에서 마이그레이션 실행 (위 Step 1 참조)
2. 또는 임시로 레거시 코드로 복원:

```bash
# 백업에서 레거시 파일 복원
cd /Users/seong-won-yeong/Dev
tar -xzf ga4TechIssueCatcher-backup-20251103-140532.tar.gz \
  --strip-components=1 \
  -C /Users/seong-won-yeong/Dev/ga4TechIssueCatcher/ \
  ga4TechIssueCatcher/src/utils/cleanupScheduler.js \
  ga4TechIssueCatcher/.env

# 서버 재시작
cd /Users/seong-won-yeong/Dev/ga4TechIssueCatcher
npm run server
```

### 문제 2: 스케줄러가 작동하지 않음
**증상**: 서버는 시작되지만 스케줄된 시간에 cleanup이 실행되지 않음

**원인**: database 설정의 is_enabled가 false이거나 cron 표현식 오류

**복구 방법**:

#### A. 데이터베이스 설정 확인
```sql
-- Supabase Dashboard SQL Editor
SELECT * FROM cleanup_settings;
```

#### B. 설정 업데이트
```sql
-- 스케줄러 활성화
UPDATE cleanup_settings
SET is_enabled = true,
    cron_expression = '0 3 * * *'
WHERE id = (SELECT id FROM cleanup_settings LIMIT 1);
```

#### C. 서버 재시작
```bash
lsof -ti:3000 | xargs kill -9
npm run server
```

### 문제 3: API 엔드포인트 오류
**증상**: POST /api/cleanup/schedule 호출 시 500 에러

**원인**:
- 잘못된 cron 표현식
- 데이터베이스 연결 오류
- 코드 변경 미적용

**복구 방법**:

#### A. Cron 표현식 검증
```bash
# 유효한 cron 표현식 예시
"0 3 * * *"   # 매일 오전 3시
"0 */6 * * *" # 6시간마다
"0 0 * * 0"   # 매주 일요일 자정
```

#### B. 데이터베이스 연결 확인
```bash
# .env 파일 확인
cat .env | grep SUPABASE

# 출력 예시:
# SUPABASE_URL=https://vmezpiybidirjxkehwer.supabase.co
# SUPABASE_ANON_KEY=...
# SUPABASE_SERVICE_ROLE_KEY=...
```

#### C. 코드 롤백
```bash
# 전체 백업에서 복원
cd /Users/seong-won-yeong/Dev
tar -xzf ga4TechIssueCatcher-backup-20251103-140532.tar.gz

# 백업 디렉토리로 이동
cd ga4TechIssueCatcher

# 현재 프로젝트와 비교
diff -r . ../ga4TechIssueCatcher/
```

### 문제 4: 마이그레이션 롤백 필요
**증상**: 새로운 시스템이 제대로 작동하지 않아 완전히 되돌려야 함

**복구 방법**:

#### Step 1: 데이터베이스 롤백
```sql
-- Supabase Dashboard SQL Editor에서 실행
DROP TABLE IF EXISTS cleanup_settings CASCADE;
```

#### Step 2: 코드 롤백
```bash
# 백업에서 전체 복원
cd /Users/seong-won-yeong/Dev

# 현재 프로젝트 백업 (추가 안전장치)
mv ga4TechIssueCatcher ga4TechIssueCatcher-failed-migration

# 백업 파일 압축 해제
tar -xzf ga4TechIssueCatcher-backup-20251103-140532.tar.gz

# 압축 해제된 디렉토리를 원래 이름으로 변경
mv ga4TechIssueCatcher-temp ga4TechIssueCatcher

cd ga4TechIssueCatcher
```

#### Step 3: .env 파일 복원
```bash
# .env의 CLEANUP_CRON 주석 제거
cat > .env.patch << 'EOF'
# Automatic cleanup schedule (cron expression)
# Default: 3 AM daily
CLEANUP_CRON=0 3 * * *
EOF

# 패치 적용 (수동으로 편집기에서 수정)
nano .env
# 또는
code .env
```

#### Step 4: 서버 재시작
```bash
npm run server
```

#### Step 5: 작동 확인
```bash
# 서버 로그 확인
# "Starting Automatic Cleanup Scheduler" 메시지 확인
```

---

## 🔍 문제 해결 가이드

### 체크리스트

#### 마이그레이션 실행 확인
```sql
-- Supabase Dashboard에서 실행
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_name = 'cleanup_settings'
) AS table_exists;
```

#### 서버 로그 확인
```bash
# 서버 실행 로그 파일 확인 (백그라운드 실행 시)
tail -f /tmp/legacy-cleanup-server.txt

# 또는 실시간 로그
npm run server
```

#### 데이터베이스 연결 테스트
```javascript
// Node.js 콘솔에서 테스트
const { supabase } = require('./src/utils/supabase.js');

(async () => {
  const { data, error } = await supabase
    .from('cleanup_settings')
    .select('*')
    .single();

  console.log('Data:', data);
  console.log('Error:', error);
})();
```

#### API 엔드포인트 테스트
```bash
# 현재 설정 조회
curl -v http://localhost:3000/api/cleanup/schedule

# 응답 코드 200 확인
# 응답 본문에 cleanup_settings 데이터 확인
```

### 자주 발생하는 오류

#### 1. "PGRST116: The result contains 0 rows"
- **원인**: cleanup_settings 테이블이 비어있음
- **해결**: 마이그레이션의 INSERT 문 실행 여부 확인

```sql
-- 레코드 존재 확인
SELECT COUNT(*) FROM cleanup_settings;

-- 레코드가 없으면 수동 삽입
INSERT INTO cleanup_settings (
  cron_expression, timezone, is_enabled,
  unsaved_crawl_ttl_days, screenshot_ttl_days, batch_size
) VALUES (
  '0 3 * * *', 'Asia/Seoul', true, 30, 30, 100
);
```

#### 2. "Invalid cron expression"
- **원인**: cron 표현식 형식 오류
- **해결**: 올바른 cron 표현식 사용

```
정확한 형식: "분 시 일 월 요일"
예시:
- "0 3 * * *"    (매일 3시)
- "*/30 * * * *" (30분마다)
- "0 0 * * 1"    (매주 월요일 자정)
```

#### 3. "Cannot read properties of null"
- **원인**: 데이터베이스 응답이 null
- **해결**: fallback 로직 확인 및 기본값 설정

```javascript
// cleanupScheduler.js의 loadSettings() 확인
const settings = data || this.getDefaultSettings();
```

---

## 📚 참고 자료

### 관련 파일
- 마이그레이션 파일: `supabase/migrations/003_add_cleanup_settings.sql`
- 스케줄러 코드: `src/utils/cleanupScheduler.js`
- API 라우트: `src/routes/cleanup.js`
- 환경 설정: `.env`
- 백업 정보: `LEGACY_CLEANUP_BACKUP.md`

### 백업 파일 정보
```
파일명: ga4TechIssueCatcher-backup-20251103-140532.tar.gz
크기: 7.9GB
위치: /Users/seong-won-yeong/Dev/ga4TechIssueCatcher-backup-20251103-140532.tar.gz
생성일: 2025-11-03 14:05:32
보관 기간: 최소 1개월 (2025-12-03까지)
```

### 추가 도움말
- Supabase Documentation: https://supabase.com/docs
- Node-Cron Documentation: https://www.npmjs.com/package/node-cron
- Cron Expression Generator: https://crontab.guru/

---

## ✅ 마이그레이션 완료 체크리스트

다음 항목들을 모두 확인하세요:

- [ ] Supabase에서 003_add_cleanup_settings.sql 마이그레이션 실행
- [ ] `SELECT * FROM cleanup_settings`로 테이블 생성 확인
- [ ] 서버 재시작 및 "Cleanup scheduler started" 로그 확인
- [ ] GET /api/cleanup/schedule 응답 확인
- [ ] POST /api/cleanup/schedule로 설정 변경 테스트
- [ ] 스케줄러 next_run 시간 확인
- [ ] 백업 파일 위치 및 복구 방법 숙지

---

**작성자**: Claude Code Assistant
**최종 업데이트**: 2025-11-03
**버전**: 1.0
