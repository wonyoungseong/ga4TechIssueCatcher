# 빠른 복구 가이드 (Quick Recovery Guide)
## Cleanup Schedule Migration 이슈 발생 시

⚠️ **긴급 상황 시 이 문서를 먼저 확인하세요!**

상세 가이드: [CLEANUP_SCHEDULE_MIGRATION_GUIDE.md](./CLEANUP_SCHEDULE_MIGRATION_GUIDE.md)

---

## 🚨 긴급 복구 (5분 안에 서버 복구)

### 상황 1: 서버가 아예 시작되지 않음

```bash
# 1. 백업에서 레거시 파일 복원
cd /Users/seong-won-yeong/Dev
tar -xzf ga4TechIssueCatcher-backup-20251103-140532.tar.gz \
  --strip-components=1 \
  -C /Users/seong-won-yeong/Dev/ga4TechIssueCatcher/ \
  ga4TechIssueCatcher/src/utils/cleanupScheduler.js \
  ga4TechIssueCatcher/.env

# 2. 서버 재시작
cd /Users/seong-won-yeong/Dev/ga4TechIssueCatcher
npm run server
```

### 상황 2: 스케줄러가 작동하지 않음

```sql
-- Supabase Dashboard SQL Editor에서 실행
-- https://supabase.com/dashboard/project/vmezpiybidirjxkehwer

-- A. 테이블 존재 확인
SELECT * FROM cleanup_settings;

-- B. 레코드가 없으면 삽입
INSERT INTO cleanup_settings (
  cron_expression, timezone, is_enabled,
  unsaved_crawl_ttl_days, screenshot_ttl_days, batch_size
) VALUES (
  '0 3 * * *', 'Asia/Seoul', true, 30, 30, 100
);

-- C. 스케줄러 활성화 확인
UPDATE cleanup_settings
SET is_enabled = true
WHERE id = (SELECT id FROM cleanup_settings LIMIT 1);
```

그 후 서버 재시작:
```bash
lsof -ti:3000 | xargs kill -9
npm run server
```

### 상황 3: 완전 롤백 (전체 복원)

```bash
# 1. 현재 상태 백업 (혹시 몰라서)
cd /Users/seong-won-yeong/Dev
mv ga4TechIssueCatcher ga4TechIssueCatcher-failed-$(date +%Y%m%d-%H%M%S)

# 2. 백업 파일 완전 복원
tar -xzf ga4TechIssueCatcher-backup-20251103-140532.tar.gz

# 3. 서버 재시작
cd ga4TechIssueCatcher
npm run server
```

---

## 📋 빠른 체크리스트

### 마이그레이션 성공 확인
```bash
# 1. 테이블 존재 확인 (Supabase Dashboard SQL Editor)
SELECT COUNT(*) FROM cleanup_settings;
# 결과: 1 이상이어야 함

# 2. 서버 로그 확인
# "Cleanup scheduler started" 메시지 확인

# 3. API 테스트
curl http://localhost:3000/api/cleanup/schedule
# {"success":true,...} 응답 확인
```

### 문제 발생 시 우선순위 점검
1. **데이터베이스**: cleanup_settings 테이블이 존재하는가?
2. **서버 로그**: 에러 메시지가 있는가?
3. **환경 변수**: .env에 Supabase 연결 정보가 있는가?
4. **코드 변경**: cleanupScheduler.js가 올바르게 업데이트되었는가?

---

## 🔗 참고 링크

### Supabase 접속
- Dashboard: https://supabase.com/dashboard
- 프로젝트: https://supabase.com/dashboard/project/vmezpiybidirjxkehwer
- SQL Editor: https://supabase.com/dashboard/project/vmezpiybidirjxkehwer/sql

### 백업 파일 위치
```
파일: /Users/seong-won-yeong/Dev/ga4TechIssueCatcher-backup-20251103-140532.tar.gz
크기: 7.9GB
날짜: 2025-11-03 14:05:32
```

### 주요 파일
- 마이그레이션: `supabase/migrations/003_add_cleanup_settings.sql`
- 스케줄러: `src/utils/cleanupScheduler.js`
- API: `src/routes/cleanup.js`
- 설정: `.env`

---

## 📞 추가 도움이 필요하면

1. 상세 가이드 확인: [CLEANUP_SCHEDULE_MIGRATION_GUIDE.md](./CLEANUP_SCHEDULE_MIGRATION_GUIDE.md)
2. 백업 정보 확인: [LEGACY_CLEANUP_BACKUP.md](./LEGACY_CLEANUP_BACKUP.md)
3. 서버 로그 확인: 터미널 출력 또는 `/tmp/legacy-cleanup-server.txt`

---

## 💡 자주 묻는 질문 (FAQ)

**Q: 마이그레이션을 꼭 해야 하나요?**
A: 아니요. 서버는 마이그레이션 없이도 기본값으로 작동합니다. 하지만 스케줄을 동적으로 변경하려면 마이그레이션이 필요합니다.

**Q: 마이그레이션 실행은 어떻게 하나요?**
A: Supabase Dashboard → SQL Editor → 마이그레이션 파일 내용 복사 → 실행

**Q: 기존 cleanup 데이터는 어떻게 되나요?**
A: 전혀 영향받지 않습니다. 이 마이그레이션은 설정 저장 방식만 변경합니다.

**Q: .env의 CLEANUP_CRON을 다시 활성화해도 되나요?**
A: 네, 임시로 복구할 때는 가능합니다. 하지만 데이터베이스 설정이 우선순위가 높습니다.

---

**작성일**: 2025-11-03
**버전**: 1.0
