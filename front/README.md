# Crawler Monitor - Analytics Tracking System

GA4 & GTM 추적 스크립트 모니터링을 위한 크롤링 시스템 대시보드

## 📋 프로젝트 개요

이 프로젝트는 여러 웹사이트의 Google Analytics 4(GA4)와 Google Tag Manager(GTM) 스크립트 설치 상태를 모니터링하기 위한 프론트엔드 애플리케이션입니다.

## ✨ 주요 기능

### 1. 대시보드 (Dashboard)
- 전체 크롤링 사이트 통계 확인
- 정상/이슈 사이트 현황 요약
- 최근 크롤링 활동 기록
- 크롤링 시작 버튼

### 2. 프로세싱 (Processing)
- 실시간 크롤링 진행 상황 모니터링
- Phase 1: 20초 타임아웃으로 1차 스크립트 검증
- Phase 2: 60초 타임아웃으로 2차 스크립트 검증 (Phase 1 오류 사이트 대상)
- 7개 브라우저 풀 동시 실행 상태 표시
- 실시간 로그 메시지 스트리밍

### 3. 리포트 (Reports)
- 크롤링 결과 상세 정보
- 이슈 사이트 목록 및 검색 기능
- 프로퍼티별 상세 정보:
  - 수집된 GA4 ID vs 예상 GA4 ID
  - 수집된 GTM ID vs 예상 GTM ID
  - Page View 이벤트 발생 여부
  - 스크린샷 정보
- 이슈 유형별 색상 구분 (누락/불일치)

### 4. 저장된 결과 (Saved Results)
- 일자별 크롤링 리포트 히스토리
- 이전 오류 기록 추적
- 수리 진행 상태 관리
- 리포트 보기 및 다운로드

### 5. 상태 관리 (Status Management)
- 프로퍼티별 상태 설정
  - 정상 (Normal)
  - 디버깅 (Debugging)
  - 오류 (Issue)
- 수리 중인 사이트 추적
- 다음 크롤링 시 상태 반영

## 🎨 디자인 시스템

- **색상 팔레트:**
  - Primary Blue: #5B7CFF
  - Success Green: #4ECDC4
  - Warning Orange: #FF9F66
  - Error Red: #FF6B6B
  - Gray Scale: #F5F7FA ~ #111827

- **컴포넌트:**
  - 카드 기반 레이아웃
  - 부드러운 그림자와 라운드 모서리
  - 반응형 그리드 시스템
  - 상태별 색상 인디케이터

## 🛠️ 기술 스택

- **React** 18.x - UI 라이브러리
- **React Router** 6.x - 페이지 라우팅
- **Lucide React** - 아이콘 라이브러리
- **CSS3** - 스타일링 (CSS Variables 활용)

## 📦 설치 및 실행

### 1. 의존성 설치
```bash
npm install
```

### 2. 개발 서버 실행
```bash
npm start
```
브라우저에서 `http://localhost:3000`으로 접속

### 3. 프로덕션 빌드
```bash
npm run build
```
빌드된 파일은 `build` 디렉토리에 생성됩니다.

## 📁 프로젝트 구조

```
crawler-monitor/
├── public/
│   ├── index.html
│   └── favicon.ico
├── src/
│   ├── components/
│   │   ├── Sidebar.js          # 사이드바 네비게이션
│   │   └── Sidebar.css
│   ├── pages/
│   │   ├── Dashboard.js        # 메인 대시보드
│   │   ├── Dashboard.css
│   │   ├── Processing.js       # 크롤링 프로세싱
│   │   ├── Processing.css
│   │   ├── Reports.js          # 결과 리포트
│   │   ├── Reports.css
│   │   ├── SavedResults.js     # 저장된 결과
│   │   ├── SavedResults.css
│   │   ├── StatusManagement.js # 상태 관리
│   │   └── StatusManagement.css
│   ├── App.js                  # 메인 앱 컴포넌트
│   ├── App.css
│   ├── index.js                # 엔트리 포인트
│   └── index.css               # 글로벌 스타일
├── package.json
└── README.md
```

## 🔌 백엔드 연동 가이드

현재 프론트엔드는 Mock 데이터를 사용하고 있습니다. 실제 백엔드와 연동하려면 다음 API 엔드포인트를 구현해야 합니다:

### API 엔드포인트 예시

```javascript
// 1. 크롤링 시작
POST /api/crawl/start

// 2. 크롤링 상태 조회
GET /api/crawl/status

// 3. 실시간 로그 스트리밍
WebSocket /api/crawl/logs

// 4. 크롤링 결과 조회
GET /api/reports/latest
GET /api/reports/{date}

// 5. 프로퍼티 상태 관리
GET /api/properties/status
PUT /api/properties/{id}/status

// 6. 저장된 리포트 목록
GET /api/reports/history
```

### 데이터 모델 예시

```typescript
interface CrawlResult {
  url: string;
  status: 'normal' | 'issue' | 'debugging';
  collectedGA4: string | null;
  expectedGA4: string;
  collectedGTM: string | null;
  expectedGTM: string;
  pageViewEvent: boolean;
  screenshot?: string;
}

interface CrawlReport {
  date: string;
  totalSites: number;
  issues: number;
  results: CrawlResult[];
}
```

## 🚀 배포

### Netlify / Vercel
```bash
npm run build
# build 디렉토리를 배포
```

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
RUN npm install -g serve
CMD ["serve", "-s", "build", "-l", "3000"]
EXPOSE 3000
```

## 📝 향후 개선 사항

- [ ] 실시간 WebSocket 연동
- [ ] 차트 및 그래프 추가 (recharts)
- [ ] 스크린샷 뷰어 모달
- [ ] CSV/Excel 다운로드 기능
- [ ] 알림 시스템 (이메일/Slack)
- [ ] 다크 모드 지원
- [ ] 필터링 및 정렬 기능 강화
- [ ] 크롤링 스케줄링 기능

## 📄 라이선스

MIT License

## 👤 개발자

Wonyoung - GA4 & GTM Specialist @ Amorepacific

---

**Note:** 이 프로젝트는 프론트엔드 UI/UX를 제공하며, 실제 크롤링 로직은 별도의 백엔드 시스템에서 구현되어야 합니다.
