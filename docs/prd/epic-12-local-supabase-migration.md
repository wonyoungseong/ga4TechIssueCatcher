# Epic 12: Local Supabase Migration - Brownfield Enhancement

## Epic Goal

Cloud Supabase 스토리지 용량 초과 문제를 해결하기 위해 Docker 기반 로컬 Supabase 환경으로 마이그레이션하고, 스크린샷 압축을 통해 70-80% 스토리지 용량을 절감한다.

## Epic Description

### Existing System Context

**Current relevant functionality:**
- Cloud Supabase (vmezpiybidirjxkehwer.supabase.co) 사용 중
- 스크린샷이 PNG 형식으로 저장 (2-5MB per file)
- 스토리지 용량 초과로 전체 프로젝트 차단 상태
- 106개 프로퍼티, 2-phase 검증 시스템 운영 중

**Technology stack:**
- Node.js 18+, Playwright
- Supabase (PostgreSQL, Storage, Auth)
- Express.js, WebSocket
- React (Frontend Dashboard)

**Integration points:**
- `src/utils/supabase.js` - Supabase client
- `src/modules/batchUploadManager.js` - Storage upload
- `src/modules/orchestrator.js` - Screenshot capture
- 모든 API route files

### Enhancement Details

**What's being added/changed:**
1. Docker Compose로 로컬 Supabase 스택 구축
2. PNG → JPEG 60% 품질로 스크린샷 압축
3. 환경변수 기반 연결 설정 변경
4. 마이그레이션 및 테스트 도구 추가

**How it integrates:**
- 기존 환경변수 사용 구조 유지 (코드 변경 최소화)
- 동일한 Supabase SDK 인터페이스 유지
- 기존 데이터베이스 스키마 완전 호환

**Success criteria:**
- 스토리지 용량 70-80% 절감
- 로컬 환경에서 전체 기능 정상 작동
- 웹 표시용 충분한 이미지 품질 유지
- 비용 $0 달성

## Stories

1. **Story 12.1: Docker Compose 환경 구축** - PostgreSQL, Storage, Auth 등 전체 Supabase 스택을 Docker로 구성
2. **Story 12.2: 데이터베이스 마이그레이션** - 기존 스키마와 데이터를 로컬 환경으로 이전
3. **Story 12.3: 스크린샷 압축 최적화** - PNG에서 JPEG 60%로 변경하여 파일 크기 대폭 감소
4. **Story 12.4: API 연결 업데이트** - 환경변수 설정을 통한 로컬 Supabase 연결
5. **Story 12.5: 테스트 시스템 구축** - 마이그레이션 검증 및 압축 효과 측정
6. **Story 12.6: 문서화 및 롤백 계획** - 운영 가이드 및 긴급 복구 절차 수립

## Compatibility Requirements

- [x] 기존 APIs 변경 없음 (환경변수만 변경)
- [x] 데이터베이스 스키마 100% 호환
- [x] UI 변경 없음
- [x] 기존 크롤링 로직 유지

## Risk Mitigation

**Primary Risk:** 로컬 환경의 안정성 및 데이터 손실 가능성

**Mitigation:**
- 클라우드 데이터 전체 백업 후 진행
- 단계적 마이그레이션 (테스트 → 검증 → 전환)
- 상세한 로깅 및 모니터링

**Rollback Plan:**
- `.env.cloud` 백업 파일 유지
- `scripts/rollback-to-cloud.sh` 스크립트 준비
- 환경변수 전환만으로 즉시 원복 가능

## Definition of Done

- [x] 모든 6개 스토리 완료 및 검증
- [x] 로컬 Supabase 전체 기능 정상 작동
- [x] 스크린샷 압축으로 70% 이상 용량 절감 확인
- [x] 기존 크롤링 및 대시보드 기능 정상 작동
- [x] 마이그레이션 문서 및 운영 가이드 완성
- [x] 롤백 절차 검증 완료

## Technical Notes

### Storage Optimization Impact
- **Before:** PNG format, 2-5MB per screenshot
- **After:** JPEG 60% quality, 200-500KB per screenshot
- **Savings:** ~70-80% storage reduction
- **Quality:** Sufficient for web display and validation

### Docker Services
- PostgreSQL 15 (port 5432)
- Supabase Studio (port 3001)
- Storage API (port 5000)
- Kong API Gateway (port 8000)
- Auth, Realtime, PostgREST services

### Migration Timeline
- Phase 1: Docker setup (30 minutes)
- Phase 2: Screenshot optimization (15 minutes)
- Phase 3: Connection updates (5 minutes)
- Phase 4: Testing (30 minutes)
- Phase 5: Documentation (20 minutes)
- Phase 6: Rollback prep (10 minutes)
- **Total:** ~2 hours

## Dependencies

- Docker and Docker Compose installation required
- Access to cloud Supabase data for export
- Local storage capacity for Docker volumes

## Related Issues

- Cloud Supabase storage quota exceeded (402 error)
- Service completely blocked due to exceed_storage_size_quota
- Dashboard statistics API returning empty responses