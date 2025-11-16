# Phase 2 Progress Data Flow 흐름도

## 전체 데이터 흐름

```
[Backend] orchestrator.js (Line 674)
   ↓
   updateCrawlProgress({
     phase2Progress: Math.round(phase2Progress),  // 0-20 범위 (시간 기반)
     phase2MaxDuration, phase2ElapsedTime, ...
   })
   ↓
[Backend] crawl.js (Line 527-531)
   ↓
   currentCrawlState.progress = {
     ...currentCrawlState.progress,
     ...progress  // phase2Progress 포함
   }
   ↓
[Backend] orchestrator.js (Line 688-696)
   ↓
   broadcast({
     type: 'crawl_status',
     data: {
       ...crawlState,  // phase2Progress 포함된 progress 객체
       browserPoolSize
     }
   })
   ↓
[Backend] server.js (Line 82-89)
   ↓
   WebSocket.send(JSON.stringify(data))
   ↓
[Network] WebSocket (ws://localhost:3001/ws)
   ↓
[Frontend] websocket.js (Line 72-79)
   ↓
   ws.onmessage → notifyListeners(message)
   ↓
[Frontend] useWebSocket.js (Line 119-122)
   ↓
   if (message.type === 'crawl_status')
     setCrawlStatus(message.data)
   ↓
[Frontend] Processing.js (Line 197)
   ↓
   <ProgressOverview progress={crawlStatus.progress} />
   ↓
[Frontend] ProgressOverview.js (Line 16-26)
   ↓
   const { phase2Progress, phase2ElapsedTime, phase2MaxDuration } = progress;
   ↓
[Frontend] ProgressOverview.js (Line 38-42)
   ↓
   const phase1Progress = 80;  // Phase 1은 항상 80%
   const phase2ProgressPercent = Math.round(phase2Progress);
   progressPercentage = Math.min(phase1Progress + phase2ProgressPercent, 100);
   ↓
[Display] Progress Bar
   ↓
   style={{ width: `${progressPercentage}%` }}
```

## 핵심 포인트

### 1. Backend Calculation (orchestrator.js:652-656)
```javascript
const elapsedTime = Date.now() - phase2StartTimestamp;
const timeBasedProgress = Math.min((elapsedTime / phase2MaxDuration) * 20, 20);
const phase2Progress = phase2CompletedCount >= phase2Total ? 20 : timeBasedProgress;
```

### 2. Data Transmission (orchestrator.js:674)
```javascript
updateCrawlProgress({
  phase2Progress: Math.round(phase2Progress),  // 0-20
  phase2MaxDuration: Math.round(phase2MaxDuration / 1000),
  phase2ElapsedTime: Math.round(elapsedTime / 1000),
  // ... other fields
});
```

### 3. WebSocket Broadcast (orchestrator.js:688-696)
```javascript
if (broadcast) {
  const crawlState = getCrawlState();
  broadcast({
    type: 'crawl_status',
    data: {
      ...crawlState,
      browserPoolSize: poolSize
    }
  });
}
```

### 4. Frontend Reception (useWebSocket.js:119-122)
```javascript
if (message.type === 'crawl_status') {
  setCrawlStatus(message.data);
}
```

### 5. Progress Display (ProgressOverview.js:38-42)
```javascript
const phase1Progress = 80;  // ← 항상 80% (Phase 1 완료)
const phase2ProgressPercent = Math.round(phase2Progress);
progressPercentage = Math.min(phase1Progress + phase2ProgressPercent, 100);
```

## 예상 동작

| 시간 | phase2Progress | 계산 | 표시 |
|------|---------------|------|------|
| 0s | 0 | 80 + 0 = 80 | 80% |
| 30s | 5 | 80 + 5 = 85 | 85% |
| 60s | 10 | 80 + 10 = 90 | 90% |
| 90s | 15 | 80 + 15 = 95 | 95% |
| 완료 | 20 | 80 + 20 = 100 | 100% |

## 확인 사항

1. **WebSocket 연결 확인**:
   - 브라우저 개발자 도구 → Network → WS 탭
   - `ws://localhost:3001/ws` 연결 확인

2. **데이터 수신 확인**:
   - Console에서 `[WS] Received:` 로그 확인
   - `crawl_status` 메시지에 `phase2Progress` 필드 존재 확인

3. **컴포넌트 props 확인**:
   - React DevTools에서 ProgressOverview 컴포넌트의 props 확인
   - `progress.phase2Progress` 값 확인

## 문제 해결

### Phase 2 진행률이 표시되지 않는 경우:

1. **WebSocket 연결 확인**:
   ```javascript
   // 브라우저 Console에서
   console.log(wsClient.getState());  // 'connected' 여야 함
   ```

2. **데이터 수신 확인**:
   ```javascript
   // Processing.js에서 로그 추가
   console.log('crawlStatus.progress:', crawlStatus.progress);
   ```

3. **Backend 데이터 전송 확인**:
   ```javascript
   // orchestrator.js:674 이후에 로그 추가
   console.log('Sending phase2Progress:', Math.round(phase2Progress));
   ```

4. **Progress 계산 확인**:
   ```javascript
   // ProgressOverview.js:42 이후에 로그 추가
   console.log('Final progress:', progressPercentage);
   ```
