# GitHub Actions 설정 가이드

GA4 TechIssueCatcher 프로젝트의 GitHub Actions CI/CD 설정 가이드입니다.

## 📋 목차
- [워크플로우 개요](#워크플로우-개요)
- [GitHub Secrets 설정](#github-secrets-설정)
- [워크플로우 상세](#워크플로우-상세)
- [트러블슈팅](#트러블슈팅)

## 워크플로우 개요

프로젝트에는 3개의 GitHub Actions 워크플로우가 구성되어 있습니다:

### 1. CI (`.github/workflows/ci.yml`)
**트리거:** Push 또는 PR to `main`, `develop`

**작업:**
- ✅ **Lint**: 코드 문법 검사
- ✅ **Build Check**: 프로젝트 구조 및 빌드 검증
- ✅ **Security Audit**: 의존성 보안 검사 및 시크릿 노출 체크

### 2. Tests (`.github/workflows/test.yml`)
**트리거:** Push 또는 PR to `main`, `develop`

**작업:**
- ✅ **Unit Tests**: 단위 테스트 실행
- ✅ **Integration Tests**: 통합 테스트 (lifecycle tests)
- ✅ **Test Summary**: 테스트 결과 요약

**환경:**
- Node.js 18
- Playwright Chromium
- Supabase (테스트 환경)

### 3. Dependency Review (`.github/workflows/dependency-review.yml`)
**트리거:** PR to `main`, `develop`

**작업:**
- ✅ 의존성 변경사항 검토
- ✅ 보안 취약점 자동 탐지 (moderate 이상)
- ✅ PR 코멘트로 결과 자동 전달

## GitHub Secrets 설정

CI/CD 워크플로우가 정상적으로 작동하려면 다음 Secrets를 설정해야 합니다.

### 필수 Secrets

#### 1. SUPABASE_URL
- **설명**: Supabase 프로젝트 URL
- **형식**: `https://your-project-id.supabase.co`
- **획득 방법**: Supabase Dashboard → Project Settings → API

#### 2. SUPABASE_ANON_KEY
- **설명**: Supabase 익명 API 키
- **형식**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **획득 방법**: Supabase Dashboard → Project Settings → API

### Secrets 설정 방법

#### 방법 1: GitHub 웹 인터페이스
1. 저장소 페이지 → **Settings** 탭
2. 왼쪽 사이드바 → **Secrets and variables** → **Actions**
3. **New repository secret** 클릭
4. Name과 Value 입력 후 **Add secret**

#### 방법 2: GitHub CLI
```bash
# SUPABASE_URL 설정
gh secret set SUPABASE_URL --body "https://your-project-id.supabase.co"

# SUPABASE_ANON_KEY 설정
gh secret set SUPABASE_ANON_KEY --body "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Secrets 확인
```bash
# 설정된 Secrets 목록 확인
gh secret list
```

## 워크플로우 상세

### CI 워크플로우 상세

#### Lint Job
```yaml
- 코드 문법 검사 (node --check)
- package.json 검증
- 선택적 lint 스크립트 실행
```

#### Build Job
```yaml
- 프로젝트 구조 검증
  - src/modules/ 디렉토리 존재
  - src/index.js 존재
  - src/server.js 존재
- .env.example 템플릿 존재 확인
```

#### Security Job
```yaml
- npm audit 실행 (moderate 레벨 이상)
- 하드코딩된 시크릿 검사
  - Supabase URL 노출 체크
  - API 키 패턴 검사
```

### Tests 워크플로우 상세

#### 환경변수
테스트 실행 시 다음 환경변수가 설정됩니다:
```yaml
NODE_ENV: test
SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
BROWSER_POOL_SIZE: 3
GA4_TIMEOUT_MS: 10000
```

#### 테스트 아티팩트
- 테스트 결과는 GitHub Actions Artifacts에 7일간 보관
- 다운로드: Actions 탭 → 워크플로우 실행 → Artifacts

### Dependency Review 상세

#### 검토 기준
- **Fail on severity**: `moderate` 이상
- **자동 PR 코멘트**: 항상 활성화

#### 검토 항목
- 새로 추가된 의존성
- 업데이트된 의존성 버전
- 알려진 보안 취약점
- 라이선스 호환성

## 로컬에서 워크플로우 테스트

### Act 사용 (선택사항)
[Act](https://github.com/nektos/act)를 사용하면 로컬에서 GitHub Actions를 테스트할 수 있습니다.

```bash
# Act 설치 (macOS)
brew install act

# CI 워크플로우 실행
act -j lint

# Tests 워크플로우 실행 (Secrets 필요)
act -j unit-tests --secret-file .env.test
```

### .env.test 파일 예시
```bash
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 트러블슈팅

### 문제 1: Playwright 설치 실패
**증상:**
```
Error: browserType.launch: Executable doesn't exist
```

**해결:**
```yaml
# 워크플로우에 이미 포함되어 있음
- name: Install Playwright browsers
  run: npx playwright install chromium
```

### 문제 2: Supabase 연결 실패
**증상:**
```
Error: Invalid Supabase URL or Anon Key
```

**해결:**
1. GitHub Secrets가 올바르게 설정되었는지 확인
2. Supabase 프로젝트가 활성 상태인지 확인
3. API 키가 만료되지 않았는지 확인

```bash
# Secrets 재설정
gh secret set SUPABASE_URL --body "새-URL"
gh secret set SUPABASE_ANON_KEY --body "새-키"
```

### 문제 3: 테스트 타임아웃
**증상:**
```
Error: Test timeout of 30000ms exceeded
```

**해결:**
워크플로우에서 타임아웃 값 조정:
```yaml
env:
  GA4_TIMEOUT_MS: 20000  # 기본값 10000에서 증가
```

### 문제 4: 의존성 리뷰 실패
**증상:**
```
Dependency review detected vulnerable packages
```

**해결:**
```bash
# 로컬에서 취약점 확인
npm audit

# 자동 수정 시도
npm audit fix

# 수동 업데이트
npm update [package-name]
```

## 모범 사례

### 1. PR 전 로컬 테스트
```bash
# 로컬에서 모든 테스트 실행
npm test
npm run test:lifecycle

# 보안 검사
npm audit
```

### 2. 커밋 메시지 규칙
워크플로우가 올바르게 트리거되도록 명확한 커밋 메시지 사용:
```bash
feat: Add new feature
fix: Fix bug in validation
test: Add unit tests
ci: Update GitHub Actions workflow
```

### 3. Branch Protection 규칙
`main` 브랜치 보호를 위해 다음 설정 권장:
- ✅ Require status checks to pass: `CI`, `Tests`
- ✅ Require branches to be up to date
- ✅ Require review from Code Owners

## 참고 자료

- [GitHub Actions 공식 문서](https://docs.github.com/en/actions)
- [Playwright CI 가이드](https://playwright.dev/docs/ci)
- [Supabase 환경변수 관리](https://supabase.com/docs/guides/getting-started/local-development)
- [npm audit 문서](https://docs.npmjs.com/cli/v8/commands/npm-audit)

## 문의 및 지원

워크플로우 관련 문제가 있다면 이슈를 생성해주세요:
- [🐛 Bug Report](https://github.com/wonyoungseong/ga4TechIssueCatcher/issues/new?template=bug_report.md)
- [💬 Discussions](https://github.com/wonyoungseong/ga4TechIssueCatcher/discussions)
