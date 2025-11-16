# Legacy Code Cleanup - Backup & Recovery Information

**Date**: 2025-11-03 14:05:32
**Backup File**: `../ga4TechIssueCatcher-backup-20251103-140532.tar.gz` (7.9GB)
**Backup Location**: `/Users/seong-won-yeong/Dev/ga4TechIssueCatcher-backup-20251103-140532.tar.gz`

## 🔄 복구 방법 (Recovery Instructions)

### Settings.js 파일 복구하기

만약 오류가 발생하여 Settings.js를 복구해야 한다면:

```bash
# 1. 백업 파일 압축 해제 (임시 디렉토리에)
cd /Users/seong-won-yeong/Dev
mkdir temp-recovery
cd temp-recovery
tar -xzf ../ga4TechIssueCatcher-backup-20251103-140532.tar.gz

# 2. Settings.js 복구
cp ga4TechIssueCatcher/front/crawler-monitor/src/pages/Settings.js \
   ../ga4TechIssueCatcher/front/crawler-monitor/src/pages/Settings.js

# 3. App.js 복구 (전체 파일)
cp ga4TechIssueCatcher/front/crawler-monitor/src/App.js \
   ../ga4TechIssueCatcher/front/crawler-monitor/src/App.js

# 4. 임시 디렉토리 정리
cd ..
rm -rf temp-recovery
```

### 개별 파일만 복구하기

```bash
# Settings.js만 복구
tar -xzf /Users/seong-won-yeong/Dev/ga4TechIssueCatcher-backup-20251103-140532.tar.gz \
  --strip-components=4 \
  -C /Users/seong-won-yeong/Dev/ga4TechIssueCatcher/front/crawler-monitor/src/pages/ \
  ga4TechIssueCatcher/front/crawler-monitor/src/pages/Settings.js

# App.js만 복구
tar -xzf /Users/seong-won-yeong/Dev/ga4TechIssueCatcher-backup-20251103-140532.tar.gz \
  --strip-components=3 \
  -C /Users/seong-won-yeong/Dev/ga4TechIssueCatcher/front/crawler-monitor/src/ \
  ga4TechIssueCatcher/front/crawler-monitor/src/App.js
```

## 🗑️ 삭제된 파일 목록 (Deleted Files)

### 2025-11-03 Cleanup #1

**파일 삭제**:
- `/Users/seong-won-yeong/Dev/ga4TechIssueCatcher/front/crawler-monitor/src/pages/Settings.js` (19KB)

**App.js 수정**:
- Line 10: `import Settings from './pages/Settings';` 제거
- Line 29: `<Route path="/settings-old" element={<Settings />} />` 제거

**검증 정보**:
- Settings.js는 오직 `/settings-old` 라우트에서만 사용됨
- Sidebar는 `/settings` (SettingsPage.js)를 사용
- 다른 파일에서 Settings.js를 import하지 않음

## ⚠️ 주의사항 (Important Notes)

1. **백업 파일 보관**: 이 백업 파일은 최소 1개월간 보관하세요
2. **복구 전 확인**: 복구하기 전에 현재 작업중인 변경사항을 커밋하세요
3. **테스트**: 복구 후 반드시 앱이 정상 작동하는지 확인하세요

## 📝 변경 이력 (Change History)

### 2025-11-03 15:30 - Cleanup Schedule Migration (.env → Database)
- **Issue**: .env 기반 cleanup schedule을 database로 이관
- **Migration Pattern**: crawler_settings와 동일한 패턴 적용
- **Database Changes**:
  - New migration: `supabase/migrations/003_add_cleanup_settings.sql`
  - New table: `cleanup_settings` with columns:
    - `cron_expression` (default: '0 3 * * *')
    - `timezone` (default: 'Asia/Seoul')
    - `is_enabled` (default: true)
    - `unsaved_crawl_ttl_days` (default: 30)
    - `screenshot_ttl_days` (default: 30)
    - `batch_size` (default: 100)
    - `last_run_at`, `next_run_at` (tracking fields)
- **Files Modified**:
  - `src/utils/cleanupScheduler.js`:
    - Removed `process.env.CLEANUP_CRON` reference (line 17)
    - Added `loadSettings()` method to fetch from database
    - Added `getDefaultSettings()` fallback
    - Added `updateLastRun()` to track execution
    - Added timezone support
  - `src/routes/cleanup.js`:
    - Added GET `/api/cleanup/schedule` endpoint
    - Updated POST `/api/cleanup/schedule` endpoint
  - `.env`:
    - Lines 57-60: CLEANUP_CRON commented out with migration note
- **Recovery Instructions**:
  ```bash
  # If migration causes issues, restore .env and cleanupScheduler.js
  tar -xzf /Users/seong-won-yeong/Dev/ga4TechIssueCatcher-backup-20251103-140532.tar.gz \
    --strip-components=1 \
    -C /Users/seong-won-yeong/Dev/ga4TechIssueCatcher/ \
    ga4TechIssueCatcher/.env \
    ga4TechIssueCatcher/src/utils/cleanupScheduler.js \
    ga4TechIssueCatcher/src/routes/cleanup.js
  ```
- **Testing**: Test scheduler with database settings via `/api/cleanup/schedule`
- **Backup**: ga4TechIssueCatcher-backup-20251103-140532.tar.gz

### 2025-11-03 14:05 - Settings.js Legacy Cleanup
- **Issue**: 사용하지 않는 legacy Settings 페이지 정리
- **Files Modified**:
  - `front/crawler-monitor/src/App.js` (import & route 제거)
- **Files Deleted**:
  - `front/crawler-monitor/src/pages/Settings.js`
- **Backup**: ga4TechIssueCatcher-backup-20251103-140532.tar.gz
