# 🚀 Crawler Monitor - 빠른 시작 가이드

## 📦 제공 파일

1. **crawler-monitor-source.tar.gz** - 전체 소스 코드
2. **crawler-monitor/** - 빌드된 정적 파일 (배포 준비 완료)
3. **README.md** - 상세 문서

## ⚡ 즉시 실행 방법

### 방법 1: 빌드된 파일 실행 (추천)

```bash
# 1. 빌드된 파일이 있는 디렉토리로 이동
cd crawler-monitor

# 2. 간단한 HTTP 서버로 실행 (Python 사용)
python -m http.server 8000

# 또는 (Python 3)
python3 -m http.server 8000

# 또는 (Node.js serve 사용)
npx serve -s . -l 8000
```

브라우저에서 `http://localhost:8000` 접속

### 방법 2: 소스 코드에서 실행

```bash
# 1. 압축 파일 해제
tar -xzf crawler-monitor-source.tar.gz
cd crawler-monitor

# 2. 의존성 설치
npm install

# 3. 개발 서버 실행
npm start
```

브라우저에서 `http://localhost:3000` 접속

## 🎯 주요 페이지 탐색

애플리케이션 실행 후 다음 페이지를 탐색할 수 있습니다:

- **/** - 대시보드 (메인 화면)
- **/processing** - 크롤링 진행 상황
- **/reports** - 결과 리포트
- **/saved-results** - 저장된 결과
- **/status-management** - 상태 관리

## 🔧 커스터마이징

### 색상 변경
`src/index.css` 파일의 CSS 변수를 수정:

```css
:root {
  --primary-blue: #5B7CFF;
  --success-green: #4ECDC4;
  --warning-orange: #FF9F66;
  --error-red: #FF6B6B;
}
```

### Mock 데이터 수정
각 페이지 컴포넌트 내의 데이터를 수정:

- `src/pages/Dashboard.js` - 대시보드 통계
- `src/pages/Processing.js` - 브라우저 풀 및 로그
- `src/pages/Reports.js` - 크롤링 결과
- `src/pages/SavedResults.js` - 저장된 리포트
- `src/pages/StatusManagement.js` - 프로퍼티 상태

## 📝 프로덕션 빌드

```bash
cd crawler-monitor
npm run build
```

빌드된 파일은 `build/` 디렉토리에 생성되며, 어떤 웹 서버에도 배포 가능합니다.

## 🐛 문제 해결

### 포트가 이미 사용 중인 경우
```bash
# 다른 포트 사용
python -m http.server 8080
# 또는
PORT=8080 npm start
```

### npm 관련 오류
```bash
# 캐시 정리
npm cache clean --force

# node_modules 재설치
rm -rf node_modules package-lock.json
npm install
```

## 💡 다음 단계

1. **백엔드 API 연동**: README.md의 "백엔드 연동 가이드" 참조
2. **실제 데이터 연동**: Mock 데이터를 API 호출로 교체
3. **WebSocket 구현**: 실시간 로그 스트리밍 구현
4. **배포**: Netlify, Vercel, 또는 자체 서버에 배포

## 📞 지원

문제가 발생하거나 질문이 있으면 프로젝트 개발자에게 문의하세요.

---

**Happy Coding! 🎉**
