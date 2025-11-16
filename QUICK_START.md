# Quick Start Guide

빠른 설정 및 실행 가이드입니다.

## 📋 사전 요구사항

- Node.js 18 이상
- Supabase 계정 (무료)
- npm 또는 yarn

## 🚀 빠른 설정 (5분)

### 1. 의존성 설치

```bash
npm install
```

### 2. Supabase 설정

#### 2.1 Supabase 프로젝트 생성
1. https://app.supabase.com 접속
2. "New Project" 클릭
3. 프로젝트 이름: `ga4-tech-issue-catcher`
4. 지역 선택 및 비밀번호 설정

#### 2.2 데이터베이스 스키마 생성
1. Supabase Dashboard → **SQL Editor**
2. `supabase/migrations/001_initial_schema.sql` 파일 내용 복사
3. SQL Editor에 붙여넣기 후 **Run** 실행

#### 2.3 API 키 복사
1. **Project Settings** → **API** 메뉴
2. 다음 항목 복사:
   - Project URL
   - anon public key
   - service_role key

### 3. 환경 변수 설정

`.env` 파일 생성:

```bash
cp .env.example .env
```

`.env` 파일에 Supabase 정보 입력:

```bash
# Supabase Configuration
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Other settings (기본값 사용 가능)
CSV_PATH=./src/ga4Property/Amore_GA4_PropertList.csv
BROWSER_POOL_SIZE=7
SERVER_PORT=3000
RETENTION_DAYS=30
```

### 4. 프로퍼티 데이터 임포트

CSV 파일에서 Supabase로 프로퍼티 데이터를 임포트합니다:

```bash
npm run db:import
```

### 5. 서버 시작

```bash
# 백엔드 서버 시작
npm run server

# 새 터미널에서 프론트엔드 시작
cd front/crawler-monitor
npm install
npm start
```

### 6. 브라우저에서 확인

- **프론트엔드**: http://localhost:3000 (React 개발 서버)
- **백엔드 API**: http://localhost:3000/api/status
- **WebSocket**: ws://localhost:3000/ws

## 📁 프로젝트 구조

```
ga4TechIssueCatcher/
├── front/
│   └── crawler-monitor/        # React 프론트엔드
│       ├── src/
│       │   ├── components/     # UI 컴포넌트
│       │   └── pages/          # 페이지
│       └── package.json
├── src/
│   ├── routes/                 # API 라우터
│   │   ├── properties.js       # 프로퍼티 관리 API
│   │   └── crawl.js            # 크롤링 제어 API
│   ├── modules/                # 크롤러 로직
│   ├── utils/                  # 유틸리티
│   │   └── supabase.js         # Supabase 클라이언트
│   ├── server.js               # Express 서버
│   └── index.js                # 크롤러 엔트리
├── scripts/
│   └── import-properties-to-supabase.js
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql
└── package.json
```

## 🎯 주요 기능

### 1. 대시보드
- 실시간 통계
- 크롤링 시작 버튼
- 최근 활동

### 2. 크롤링 프로세싱
- 실시간 진행 상황
- 브라우저 풀 상태
- 로그 스트림

### 3. 리포트
- 검증 결과 조회
- 이슈 필터링
- 상세 정보

### 4. 저장된 결과
- 과거 크롤링 기록
- 다운로드 기능

### 5. 상태 관리
- 프로퍼티 상태 변경
- 변경 이력 추적

## 🔧 주요 명령어

```bash
# 개발
npm run dev              # 개발 서버 시작
npm run server           # 백엔드 서버만 시작
npm start                # 크롤러 실행

# 데이터베이스
npm run db:import        # CSV → Supabase 임포트
npm run db:test          # Supabase 연결 테스트

# 테스트
npm test                 # 테스트 실행
npm run test:watch       # 테스트 watch 모드
```

## 🐛 문제 해결

### Supabase 연결 실패
```
Error: Missing required Supabase environment variables
```
→ `.env` 파일에 Supabase 설정이 올바르게 입력되었는지 확인

### 포트 충돌
```
Error: Port 3000 already in use
```
→ `.env`에서 `SERVER_PORT` 변경

### 프론트엔드 연결 실패
```
Network Error
```
→ 백엔드 서버가 실행 중인지 확인

## 📚 상세 문서

- **Supabase 설정**: [SUPABASE_SETUP.md](./SUPABASE_SETUP.md)
- **API 문서**: [API.md](./API.md) (생성 예정)
- **아키텍처**: [ARCHITECTURE.md](./ARCHITECTURE.md) (생성 예정)

## 🆘 도움이 필요하신가요?

1. GitHub Issues 생성
2. 팀 Slack 채널 문의
3. 문서 확인: [SUPABASE_SETUP.md](./SUPABASE_SETUP.md)
