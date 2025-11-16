# Consent Mode 기능 범위 분석

## 요구사항 요약
page_view 미수집이 Consent Mode 때문인 경우, 이를 정상으로 간주하는 기능 추가

## Epic vs Story 판단 기준

### Story 10.2로 처리 가능한 경우 (추천 ✅)
**조건**:
- 단일 스프린트 내 완료 가능 (2-5일)
- 기존 아키텍처 변경 없음
- 단일 팀이 독립적으로 작업 가능
- 명확한 기술적 해결책 존재

**범위**:
1. DB 마이그레이션: `properties` 테이블에 `has_consent_mode` BOOLEAN 추가
2. 백엔드 API 수정: Property CRUD에 필드 추가
3. 크롤링 감지: 간단한 Consent Mode 감지 로직
4. 검증 로직: Consent Mode 시 page_view 검증 스킵
5. UI 업데이트: 설정 페이지에 토글 추가

**예상 작업량**: 3-5 story points (중간 복잡도)

### Epic으로 승격해야 하는 경우
**조건**:
- 여러 스프린트 필요 (1-4주)
- 아키텍처 레벨 변경
- 여러 팀 협업 필요
- 불확실성이 높음

**확장 범위** (Epic으로 승격 시):
1. **다양한 Consent Mode 시나리오 지원**
   - Google Consent Mode v2 전체 스펙 구현
   - `analytics_storage`, `ad_storage` 개별 관리
   - 동적 consent 변경 추적

2. **고급 검증 로직**
   - Consent 거부 후에도 일부 이벤트 수집 확인 (ping 이벤트 등)
   - Consent granted 후 page_view 재전송 확인

3. **Consent Mode 분석 대시보드**
   - Consent 동의율 통계
   - Consent Mode 미설정 사이트 경고

4. **자동 감지 및 추천**
   - 크롤링 중 자동으로 Consent Mode 감지하여 플래그 제안
   - 패턴 학습을 통한 false positive 감소

## 추천: Story 10.2로 진행 ✅

### 이유:
1. **명확한 기술적 해결책 존재**
   - Consent Mode 감지: `window.dataLayer` 또는 `gtag` API 확인
   - 검증 로직 수정: 간단한 조건문 추가

2. **단일 스프린트 완료 가능**
   - DB 마이그레이션: 30분
   - 백엔드 수정: 2-3시간
   - 크롤링 로직: 3-4시간
   - 프론트엔드 UI: 2-3시간
   - 테스트 및 QA: 1-2시간
   - **총 예상**: 1-2일

3. **기존 아키텍처 활용**
   - Property 메타데이터 확장만 필요
   - 검증 로직 분기 추가만 필요
   - 새로운 서비스나 모듈 불필요

4. **점진적 개선 가능**
   - MVP: 수동 Consent Mode 플래그 + 검증 스킵
   - 향후: 자동 감지, 고급 분석 등은 별도 Story/Epic으로

### Story 10.2 정의안

**Title**: Consent Mode 지원 - page_view 미수집 예외 처리

**Description**:
사용자가 Consent를 거부한 사이트에서 page_view 이벤트가 수집되지 않는 것은 정상이므로, Consent Mode가 활성화된 Property에 대해서는 page_view 미수집을 오류로 간주하지 않도록 검증 로직을 개선합니다.

**Acceptance Criteria**:
1. ✅ Property 설정에 "Consent Mode 사용" 체크박스 추가
2. ✅ Consent Mode 활성화된 Property는 page_view 미수집 시 경고 대신 정보성 메시지 표시
3. ✅ 이슈 상세 화면에서 Consent Mode 상태 표시
4. ✅ Consent Mode 감지 로직 추가 (자동 감지는 선택 사항)
5. ✅ 기존 Property에 대한 마이그레이션 (기본값: false)

**Technical Tasks**:
- [ ] DB: `properties` 테이블에 `has_consent_mode` BOOLEAN 컬럼 추가
- [ ] Backend: Property API에 `has_consent_mode` 필드 추가
- [ ] Backend: `configValidator.js`에서 Consent Mode 시 page_view 검증 로직 수정
- [ ] Frontend: `SettingsPage.js`에 Consent Mode 토글 추가
- [ ] Frontend: `IssueDetailModal.js`에 Consent Mode 상태 표시
- [ ] Frontend: `StatusManagement.js`에 Consent Mode 아이콘/필터 추가
- [ ] Crawler: (선택) Consent Mode 자동 감지 로직 추가

**Story Points**: 5 (중간 복잡도)

**Priority**: High (데이터 정확도에 직접 영향)

**Dependencies**: 없음

---

## 향후 Epic 후보 (별도 검토)

**Epic: "Consent Mode 고급 분석 및 자동화"**

Stories:
- Story 10.3: Consent Mode 자동 감지 및 플래그 제안
- Story 10.4: Consent 동의율 분석 대시보드
- Story 10.5: Google Consent Mode v2 전체 스펙 지원
- Story 10.6: Consent 상태별 이벤트 추적 및 보고

---

## 결론

**Story 10.2로 진행을 추천합니다.**

- 1-2일 내 완료 가능
- 즉시 비즈니스 가치 제공 (false positive 감소)
- 향후 확장 가능한 구조
- 리스크 낮음

Epic으로 승격할 필요는 없으며, 향후 요구사항이 추가되면 별도 Epic으로 관리하는 것이 더 효율적입니다.
