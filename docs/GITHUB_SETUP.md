# GitHub 설정 가이드

GA4 Tech Issue Catcher 프로젝트를 GitHub에 업로드하고 관리하기 위한 단계별 가이드입니다.

## 📋 목차

1. [Git 초기화](#1-git-초기화)
2. [GitHub 저장소 생성](#2-github-저장소-생성)
3. [레이블 설정](#3-레이블-설정)
4. [첫 커밋 및 푸시](#4-첫-커밋-및-푸시)

## 1. Git 초기화

### .gitignore 확인

현재 프로젝트에 `.gitignore` 파일이 있는지 확인하세요. 없다면 생성이 필요합니다.

```bash
# .gitignore 파일 확인
cat .gitignore
```

### Git 저장소 초기화

```bash
# Git 초기화
git init

# 현재 상태 확인
git status
```

## 2. GitHub 저장소 생성

### GitHub CLI로 저장소 생성

```bash
# 공개 저장소 생성
gh repo create ga4TechIssueCatcher --public --source=. --remote=origin

# 또는 비공개 저장소 생성
gh repo create ga4TechIssueCatcher --private --source=. --remote=origin
```

### 수동으로 저장소 생성한 경우

1. GitHub 웹사이트에서 저장소 생성
2. 로컬에서 리모트 추가:

```bash
git remote add origin https://github.com/YOUR_USERNAME/ga4TechIssueCatcher.git
```

## 3. 레이블 설정

### 자동 설정 (권장)

준비된 스크립트를 사용하여 모든 레이블을 한 번에 생성합니다:

```bash
# 레이블 생성 스크립트 실행
./scripts/setup-github-labels.sh
```

### 생성되는 레이블 목록

#### 📦 개발 영역 (Development Area)
- `area:frontend` - 프론트엔드 (Dashboard, UI)
- `area:backend` - 백엔드 (Orchestrator, API)
- `area:infrastructure` - 인프라 (DB, Supabase, Docker)
- `area:automation` - 자동화 (Crawler, Browser Pool)
- `area:devops` - DevOps (CI/CD, Deployment)

#### 📊 복잡도 (Complexity)
- `complexity:easy` - 쉬움 (<2시간)
- `complexity:medium` - 보통 (2-8시간)
- `complexity:hard` - 복잡함 (>8시간)

#### 🔧 작업 유형 (Work Type)
- `type:feature` - 새로운 기능
- `type:bug` - 버그 수정
- `type:enhancement` - 기능 개선
- `type:documentation` - 문서화
- `type:test` - 테스트
- `type:refactor` - 리팩토링
- `type:performance` - 성능 최적화

#### ⚡ 우선순위 (Priority)
- `priority:critical` - 긴급
- `priority:high` - 높음
- `priority:medium` - 보통
- `priority:low` - 낮음

#### 📌 상태 (Status)
- `status:blocked` - 블로킹됨
- `status:in-progress` - 진행 중
- `status:review-needed` - 리뷰 필요
- `status:ready` - 준비 완료

#### 🧩 컴포넌트 (Component)
- `component:orchestrator` - Orchestrator 모듈
- `component:browser-pool` - Browser Pool Manager
- `component:network-capturer` - Network Event Capturer
- `component:dashboard` - Web Dashboard
- `component:database` - Supabase Integration

#### ⭐ 특수 레이블 (Special)
- `good-first-issue` - 처음 기여하기 좋은 이슈
- `help-wanted` - 도움 필요
- `question` - 질문/논의
- `duplicate` - 중복
- `wontfix` - 수정 안 함

### 수동으로 레이블 생성

개별 레이블을 생성하려면:

```bash
# 기본 형식
gh label create "label-name" --description "설명" --color "색상코드"

# 예시
gh label create "area:frontend" --description "프론트엔드 작업" --color "0052CC"
```

## 4. 첫 커밋 및 푸시

### 파일 스테이징 및 커밋

```bash
# 모든 파일 추가
git add .

# 첫 커밋
git commit -m "Initial commit: GA4 Tech Issue Catcher

- Automated GA4/GTM validation system
- Browser pool management with Playwright
- Two-phase validation strategy
- Web dashboard with real-time monitoring
- Supabase integration for data storage"

# GitHub에 푸시
git push -u origin main
```

## 5. 이슈 생성 예시

### CLI로 이슈 생성

```bash
# 프론트엔드 기능 추가
gh issue create \
  --title "대시보드에 필터링 기능 추가" \
  --body "사용자가 크롤링 결과를 날짜와 상태로 필터링할 수 있는 기능 필요" \
  --label "area:frontend,type:feature,complexity:medium,priority:high"

# 버그 수정
gh issue create \
  --title "Phase 2 타임아웃 처리 개선" \
  --body "일부 느린 사이트에서 Phase 2 타임아웃이 발생하는 문제 수정 필요" \
  --label "area:backend,type:bug,complexity:hard,priority:critical"

# 문서화 작업
gh issue create \
  --title "API 문서 작성" \
  --body "REST API 엔드포인트 문서화 필요" \
  --label "type:documentation,complexity:easy,priority:medium"
```

### 이슈 목록 조회

```bash
# 높은 우선순위 이슈 목록
gh issue list --label "priority:high"

# 프론트엔드 관련 준비된 이슈
gh issue list --label "area:frontend,status:ready"

# 도움이 필요한 이슈
gh issue list --label "help-wanted"
```

## 6. 프로젝트 보드 설정 (선택사항)

GitHub Projects를 사용하여 칸반 보드 생성:

```bash
# 프로젝트 생성
gh project create --title "GA4 Tech Issue Catcher" --body "Development tracking board"
```

## 7. 브랜치 전략

### 권장 브랜치 구조

```
main (production)
├── develop (development)
├── feature/dashboard-filters
├── feature/phase2-optimization
├── bugfix/timeout-handling
└── docs/api-documentation
```

### 브랜치 생성 예시

```bash
# Feature 브랜치
git checkout -b feature/dashboard-filters

# Bugfix 브랜치
git checkout -b bugfix/phase2-timeout

# Documentation 브랜치
git checkout -b docs/api-documentation
```

## 8. 유용한 GitHub CLI 명령어

```bash
# 저장소 정보 확인
gh repo view

# 이슈 검색
gh issue list --search "timeout"

# PR 생성
gh pr create --title "Title" --body "Description"

# 레이블 목록 확인
gh label list

# 특정 레이블 수정
gh label edit "label-name" --description "new description" --color "new-color"
```

## 9. 환경 변수 보안

GitHub Secrets 설정 (CI/CD용):

```bash
# GitHub Secrets 추가
gh secret set SUPABASE_URL
gh secret set SUPABASE_ANON_KEY

# Secrets 목록 확인
gh secret list
```

## 트러블슈팅

### 인증 문제

```bash
# GitHub CLI 로그인 확인
gh auth status

# 재로그인
gh auth login
```

### 레이블 생성 실패

```bash
# 기존 레이블 삭제 후 재생성
gh label delete "label-name"
./scripts/setup-github-labels.sh
```

### 원격 저장소 연결 확인

```bash
# 원격 저장소 확인
git remote -v

# 원격 저장소 변경
git remote set-url origin https://github.com/USERNAME/REPO.git
```

## 참고 자료

- [GitHub CLI 문서](https://cli.github.com/manual/)
- [GitHub Labels 가이드](https://docs.github.com/en/issues/using-labels-and-milestones-to-track-work/managing-labels)
- [Git 브랜치 전략](https://git-scm.com/book/en/v2/Git-Branching-Branching-Workflows)
