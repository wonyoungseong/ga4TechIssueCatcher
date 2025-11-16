# Branching Strategy

GA4 TechIssueCatcher 프로젝트의 Git 브랜치 전략 및 워크플로우 가이드입니다.

## 목차
- [브랜치 모델](#브랜치-모델)
- [브랜치 종류](#브랜치-종류)
- [브랜치 네이밍 규칙](#브랜치-네이밍-규칙)
- [워크플로우](#워크플로우)
- [브랜치 보호 규칙](#브랜치-보호-규칙)
- [릴리스 프로세스](#릴리스-프로세스)

## 브랜치 모델

이 프로젝트는 **GitHub Flow**를 기반으로 한 단순화된 브랜치 전략을 사용합니다.

```
main (production-ready)
  ├── develop (integration)
  │     ├── feature/GA4-123-feature-name
  │     ├── bugfix/GA4-456-bug-description
  │     ├── hotfix/GA4-789-critical-fix
  │     └── docs/update-readme
```

### 왜 GitHub Flow인가?

- **단순성**: 복잡한 Git Flow보다 이해하기 쉽고 관리하기 간단
- **빠른 배포**: 필요한 기능을 빠르게 프로덕션에 배포 가능
- **CI/CD 친화적**: 자동화된 테스트 및 배포와 잘 어울림
- **소규모 팀**: 1-3명의 개발자에게 적합

## 브랜치 종류

### 1. main (프로덕션 브랜치)

- **목적**: 항상 배포 가능한 안정적인 코드 유지
- **보호 규칙**:
  - ✅ Direct push 금지
  - ✅ PR 리뷰 필수 (1명 이상)
  - ✅ CI 테스트 통과 필수
  - ✅ 브랜치 최신 상태 유지 필수
- **병합 조건**: 모든 테스트 통과 + 리뷰 승인
- **자동 배포**: main 브랜치 푸시 시 프로덕션 배포 (향후)

### 2. develop (개발 통합 브랜치)

- **목적**: 다음 릴리스를 위한 개발 작업 통합
- **보호 규칙**:
  - ✅ Direct push 금지
  - ✅ PR 리뷰 권장
  - ✅ CI 테스트 통과 필수
- **병합 조건**: CI 테스트 통과
- **자동 배포**: develop 브랜치 푸시 시 스테이징 환경 배포 (향후)

### 3. Feature 브랜치

- **목적**: 새로운 기능 개발
- **생명주기**: 기능 완성 후 삭제
- **베이스 브랜치**: `develop`
- **병합 대상**: `develop`

### 4. Bugfix 브랜치

- **목적**: 버그 수정
- **생명주기**: 버그 수정 후 삭제
- **베이스 브랜치**: `develop`
- **병합 대상**: `develop`

### 5. Hotfix 브랜치

- **목적**: 프로덕션 긴급 수정
- **생명주기**: 수정 완료 후 삭제
- **베이스 브랜치**: `main`
- **병합 대상**: `main` AND `develop` (양방향)

### 6. Docs 브랜치

- **목적**: 문서 업데이트
- **생명주기**: 문서 업데이트 후 삭제
- **베이스 브랜치**: `develop`
- **병합 대상**: `develop`

## 브랜치 네이밍 규칙

### 형식
```
<type>/<issue-number>-<short-description>
```

### 타입
- `feature/` - 새로운 기능
- `bugfix/` - 버그 수정
- `hotfix/` - 긴급 수정
- `docs/` - 문서 업데이트
- `refactor/` - 코드 리팩토링
- `test/` - 테스트 추가/수정
- `chore/` - 기타 작업

### 예시
```bash
# Good ✅
feature/GA4-123-add-consent-mode-support
bugfix/GA4-456-fix-timeout-issue
hotfix/GA4-789-fix-critical-memory-leak
docs/update-installation-guide
refactor/orchestrator-cleanup

# Bad ❌
new-feature          # 타입 없음
GA4-123              # 설명 없음
fix_bug              # 언더스코어 사용
feature/AddNewStuff  # CamelCase 사용
```

### 네이밍 가이드라인
- **소문자 사용**: 모든 브랜치 이름은 소문자
- **하이픈 구분**: 단어는 하이픈(-)으로 구분
- **이슈 번호 포함**: GitHub 이슈 번호 포함 (있는 경우)
- **간결한 설명**: 3-5 단어로 브랜치 목적 명확히 설명

## 워크플로우

### 기능 개발 워크플로우

```bash
# 1. develop 브랜치에서 최신 코드 받기
git checkout develop
git pull origin develop

# 2. feature 브랜치 생성
git checkout -b feature/GA4-123-add-new-feature

# 3. 작업 및 커밋
git add .
git commit -m "feat: Add new feature"

# 4. 원격 브랜치에 푸시
git push -u origin feature/GA4-123-add-new-feature

# 5. GitHub에서 PR 생성
# develop ← feature/GA4-123-add-new-feature

# 6. 리뷰 및 승인 후 병합

# 7. 로컬 브랜치 정리
git checkout develop
git pull origin develop
git branch -d feature/GA4-123-add-new-feature
```

### 버그 수정 워크플로우

```bash
# 1. develop에서 bugfix 브랜치 생성
git checkout develop
git pull origin develop
git checkout -b bugfix/GA4-456-fix-validation-error

# 2. 버그 수정 및 테스트
# - 버그 재현 테스트 작성
# - 버그 수정
# - 테스트 통과 확인

# 3. 커밋 및 푸시
git add .
git commit -m "fix: Fix validation error in orchestrator"
git push -u origin bugfix/GA4-456-fix-validation-error

# 4. PR 생성 및 병합
# develop ← bugfix/GA4-456-fix-validation-error
```

### 긴급 수정 (Hotfix) 워크플로우

```bash
# 1. main에서 hotfix 브랜치 생성
git checkout main
git pull origin main
git checkout -b hotfix/GA4-789-critical-fix

# 2. 긴급 수정
git add .
git commit -m "fix: Fix critical production issue"
git push -u origin hotfix/GA4-789-critical-fix

# 3. main으로 PR 생성 및 병합
# main ← hotfix/GA4-789-critical-fix

# 4. develop에도 적용 (중요!)
git checkout develop
git pull origin develop
git merge hotfix/GA4-789-critical-fix
git push origin develop

# 5. 브랜치 삭제
git branch -d hotfix/GA4-789-critical-fix
git push origin --delete hotfix/GA4-789-critical-fix
```

### 릴리스 워크플로우

```bash
# 1. develop이 안정화되면 main으로 PR 생성
# main ← develop

# 2. 버전 태그 생성
git checkout main
git pull origin main
git tag -a v1.1.0 -m "Release version 1.1.0"
git push origin v1.1.0

# 3. GitHub Release 생성
gh release create v1.1.0 \
  --title "v1.1.0 - Feature Release" \
  --notes "Release notes..."
```

## 브랜치 보호 규칙

### main 브랜치 보호 규칙

GitHub 저장소 Settings → Branches → Add rule (Branch name pattern: `main`)

✅ **Require a pull request before merging**
- Require approvals: 1
- Dismiss stale pull request approvals when new commits are pushed

✅ **Require status checks to pass before merging**
- Require branches to be up to date before merging
- Status checks required:
  - `CI / Lint Code`
  - `CI / Build Check`
  - `CI / Security Audit`
  - `Tests / Unit Tests`

✅ **Require conversation resolution before merging**

✅ **Do not allow bypassing the above settings**

❌ **Allow force pushes**: Disabled
❌ **Allow deletions**: Disabled

### develop 브랜치 보호 규칙

GitHub 저장소 Settings → Branches → Add rule (Branch name pattern: `develop`)

✅ **Require a pull request before merging**
- Require approvals: 0 (권장사항이지만 필수 아님)

✅ **Require status checks to pass before merging**
- Require branches to be up to date before merging
- Status checks required:
  - `CI / Lint Code`
  - `CI / Build Check`
  - `Tests / Unit Tests`

❌ **Allow force pushes**: Disabled
❌ **Allow deletions**: Disabled

## 브랜치 보호 규칙 설정 방법

### 방법 1: GitHub Web UI

1. 저장소 페이지 → **Settings** 탭
2. 왼쪽 사이드바 → **Branches**
3. **Add branch protection rule** 클릭
4. **Branch name pattern** 입력: `main` 또는 `develop`
5. 위의 보호 규칙 체크박스 선택
6. **Create** 클릭

### 방법 2: GitHub CLI (스크립트)

```bash
# main 브랜치 보호 규칙 설정
gh api repos/wonyoungseong/ga4TechIssueCatcher/branches/main/protection \
  -X PUT \
  -f required_status_checks='{"strict":true,"contexts":["CI / Lint Code","CI / Build Check","Tests / Unit Tests"]}' \
  -f enforce_admins=true \
  -f required_pull_request_reviews='{"required_approving_review_count":1}' \
  -f restrictions=null

# develop 브랜치 보호 규칙 설정
gh api repos/wonyoungseong/ga4TechIssueCatcher/branches/develop/protection \
  -X PUT \
  -f required_status_checks='{"strict":true,"contexts":["CI / Lint Code","Tests / Unit Tests"]}' \
  -f enforce_admins=false \
  -f required_pull_request_reviews='{"required_approving_review_count":0}' \
  -f restrictions=null
```

## 릴리스 프로세스

### 버전 관리

이 프로젝트는 [Semantic Versioning](https://semver.org/)을 따릅니다:

```
v<MAJOR>.<MINOR>.<PATCH>

예: v1.2.3
```

- **MAJOR**: Breaking changes (API 변경)
- **MINOR**: 새로운 기능 추가 (하위 호환)
- **PATCH**: 버그 수정 (하위 호환)

### 릴리스 체크리스트

**릴리스 전:**
- [ ] develop 브랜치의 모든 기능이 안정화됨
- [ ] 모든 테스트 통과
- [ ] 문서 업데이트 완료
- [ ] CHANGELOG.md 업데이트
- [ ] package.json 버전 업데이트

**릴리스:**
- [ ] develop → main PR 생성
- [ ] 리뷰 및 승인
- [ ] 병합 완료
- [ ] Git 태그 생성 (v1.x.x)
- [ ] GitHub Release 생성
- [ ] 배포 (향후)

**릴리스 후:**
- [ ] 릴리스 노트 작성
- [ ] 팀에 공지
- [ ] 모니터링 확인

## 커밋 메시지 규칙

[Conventional Commits](https://www.conventionalcommits.org/)를 따릅니다:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### 예시
```
feat(orchestrator): Add two-phase validation strategy

Implement smart exit on expected measurement ID detection
for improved performance.

Closes #123
```

자세한 내용은 [CONTRIBUTING.md](../CONTRIBUTING.md)를 참조하세요.

## 브랜치 정리

### 자동 삭제 설정

GitHub 저장소 Settings → General → Pull Requests
- ✅ **Automatically delete head branches**: Enabled

### 수동 정리

```bash
# 로컬에서 병합된 브랜치 확인
git branch --merged

# 로컬 브랜치 삭제
git branch -d feature/GA4-123-add-new-feature

# 원격 브랜치 삭제
git push origin --delete feature/GA4-123-add-new-feature

# 원격에서 삭제된 브랜치 로컬 정리
git fetch --prune
```

## 자주 묻는 질문 (FAQ)

### Q: feature 브랜치를 main에 직접 병합할 수 있나요?
**A:** 아니요. 모든 feature 브랜치는 먼저 `develop`에 병합되어야 합니다. `main`은 오직 `develop`이나 `hotfix` 브랜치에서만 병합을 받습니다.

### Q: 긴급 수정은 어떻게 하나요?
**A:** `main`에서 `hotfix/` 브랜치를 생성하고, 수정 후 `main`과 `develop` 양쪽에 모두 병합합니다.

### Q: develop 브랜치를 언제 main으로 병합하나요?
**A:** 충분한 기능이 안정화되고 릴리스 준비가 완료되었을 때 병합합니다. 보통 스프린트 종료 시점이나 주요 마일스톤 달성 시점입니다.

### Q: 브랜치 보호 규칙을 우회할 수 있나요?
**A:** main 브랜치는 관리자도 우회할 수 없도록 설정되어 있습니다. 긴급 상황에서도 반드시 PR 프로세스를 따라야 합니다.

### Q: 여러 기능을 동시에 개발하고 있어요. 어떻게 관리하나요?
**A:** 각 기능마다 독립적인 feature 브랜치를 생성하세요. 완성된 기능부터 순차적으로 `develop`에 병합합니다.

## 참고 자료

- [GitHub Flow](https://guides.github.com/introduction/flow/)
- [Semantic Versioning](https://semver.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Git Branching Model](https://nvie.com/posts/a-successful-git-branching-model/)

## 문의

브랜치 전략에 대한 질문이 있다면:
- 📝 [Create an Issue](https://github.com/wonyoungseong/ga4TechIssueCatcher/issues/new/choose)
- 💬 [GitHub Discussions](https://github.com/wonyoungseong/ga4TechIssueCatcher/discussions)

---

**마지막 업데이트**: 2025-01-16
