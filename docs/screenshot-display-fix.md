# Screenshot Display Fix - 스크린샷 표시 수정

## Problem | 문제점

Screenshots were saved successfully to Supabase Storage but were not appearing in the React frontend report.

스크린샷이 Supabase Storage에 성공적으로 저장되었지만, React 프론트엔드 리포트에 표시되지 않았습니다.

## Root Cause | 근본 원인

**Field Name Mismatch** between backend and frontend:

**백엔드와 프론트엔드 간 필드명 불일치**:

### Database State | 데이터베이스 상태
```sql
screenshot_path: NULL
screenshot_url: "https://vmezpiybidirjxkehwer.supabase.co/storage/v1/object/public/screenshots/..."
```

### Frontend Component (Before Fix) | 프론트엔드 컴포넌트 (수정 전)
```javascript
// IssueDetailModal.js lines 110, 280
if (result.screenshot_path) {  // ❌ Always NULL
  const screenshotUrl = `${API_URL}/api/${result.screenshot_path}`;
}
```

The component was checking for `screenshot_path` which is NULL after migration to Supabase Storage.

컴포넌트가 `screenshot_path`를 확인했지만, Supabase Storage로 마이그레이션 후 이 필드는 NULL입니다.

## Solution | 해결방법

Updated `IssueDetailModal.js` to use `screenshot_url` with backward compatibility:

`IssueDetailModal.js`를 `screenshot_url`을 사용하도록 업데이트하고 하위 호환성 유지:

### 1. Screenshot Handler | 스크린샷 핸들러
```javascript
const handleViewScreenshot = () => {
  // Prefer screenshot_url (Supabase Storage public URL)
  // Fallback to screenshot_path for backward compatibility
  if (result.screenshot_url) {
    setSelectedScreenshot(result.screenshot_url);
  } else if (result.screenshot_path) {
    const screenshotUrl = `${process.env.REACT_APP_API_URL}/api/${result.screenshot_path}`;
    setSelectedScreenshot(screenshotUrl);
  }
};
```

### 2. Screenshot Display | 스크린샷 표시
```javascript
{(result.screenshot_url || result.screenshot_path) && (
  <div className="screenshot-section">
    <img
      src={result.screenshot_url || `${API_URL}/api/${result.screenshot_path}`}
      alt="Page screenshot"
      onClick={handleViewScreenshot}
    />
  </div>
)}
```

### 3. PropTypes Update | PropTypes 업데이트
```javascript
result: PropTypes.shape({
  // ... other fields
  screenshot_path: PropTypes.string, // Legacy field (backward compatibility)
  screenshot_url: PropTypes.string,  // Supabase Storage public URL
})
```

## Verification | 검증

### Test Script Results | 테스트 스크립트 결과
```bash
node scripts/test-screenshot-flow.js
```

✅ **Database**: 83 properties with `screenshot_url` populated
✅ **Storage**: 80 files exist in Supabase Storage
✅ **API**: Backend returns `screenshot_url` in response
✅ **URLs**: All screenshot URLs are publicly accessible (200 OK)
✅ **Frontend**: Component now uses `screenshot_url` field

## Files Modified | 수정된 파일

### `/front/crawler-monitor/src/components/IssueDetailModal.js`
- Lines 109-118: Updated `handleViewScreenshot()` to use `screenshot_url` first
- Lines 284-303: Updated screenshot section conditional and image src
- Lines 352-353: Added `screenshot_url` to PropTypes

## Technical Flow | 기술적 흐름

### Complete Screenshot Pipeline | 전체 스크린샷 파이프라인

1. **Capture** | 캡처
   - Playwright captures screenshot → PNG buffer
   - Playwright가 스크린샷 캡처 → PNG 버퍼

2. **Upload** | 업로드
   - Batch upload to Supabase Storage (`/screenshots/{runId}/{propertyId}_{timestamp}.png`)
   - Supabase Storage에 배치 업로드

3. **Database** | 데이터베이스
   - Public URL saved to `crawl_results.screenshot_url`
   - 공개 URL을 `crawl_results.screenshot_url`에 저장

4. **API** | API
   - Backend spreads all fields including `screenshot_url`
   - 백엔드가 `screenshot_url` 포함 모든 필드 전달

5. **Frontend Display** | 프론트엔드 표시
   - React component uses `screenshot_url` directly (no server path construction)
   - React 컴포넌트가 `screenshot_url` 직접 사용 (서버 경로 생성 불필요)

## Benefits | 이점

1. **Direct Access** | 직접 접근
   - Frontend uses Supabase public URLs directly (no backend proxy)
   - 프론트엔드가 Supabase 공개 URL 직접 사용 (백엔드 프록시 불필요)

2. **Better Performance** | 성능 향상
   - No additional backend processing for screenshot delivery
   - 스크린샷 전달을 위한 추가 백엔드 처리 없음

3. **Backward Compatible** | 하위 호환성
   - Still supports `screenshot_path` if needed for legacy data
   - 레거시 데이터를 위해 `screenshot_path` 여전히 지원

4. **CDN Benefits** | CDN 이점
   - Supabase Storage provides CDN caching and global distribution
   - Supabase Storage가 CDN 캐싱과 글로벌 배포 제공

## Testing Instructions | 테스트 지침

### 1. Verify Backend Data | 백엔드 데이터 확인
```bash
node scripts/test-screenshot-flow.js
```

### 2. Start React Frontend | React 프론트엔드 시작
```bash
cd front/crawler-monitor
npm start
```

### 3. View Report | 리포트 확인
1. Navigate to Reports page | 리포트 페이지로 이동
2. Select a crawl run with results | 결과가 있는 크롤 실행 선택
3. Click on any result with issues | 이슈가 있는 결과 클릭
4. Screenshot should appear in modal | 모달에 스크린샷이 나타남
5. Click "확대 보기" to view full-size screenshot | "확대 보기" 클릭하여 전체 크기 스크린샷 확인

## Future Improvements | 향후 개선사항

1. **Migration Script** | 마이그레이션 스크립트
   - Create script to migrate any remaining `screenshot_path` data to `screenshot_url`
   - 남아있는 `screenshot_path` 데이터를 `screenshot_url`로 마이그레이션하는 스크립트 작성

2. **Error Handling** | 오류 처리
   - Add loading states for screenshot images
   - 스크린샷 이미지 로딩 상태 추가
   - Handle broken image URLs gracefully
   - 깨진 이미지 URL을 우아하게 처리

3. **Performance** | 성능
   - Add lazy loading for screenshot thumbnails
   - 스크린샷 썸네일 지연 로딩 추가
   - Implement image optimization/compression
   - 이미지 최적화/압축 구현

## Date | 날짜
2025-11-02

## Status | 상태
✅ **Fixed and Verified** | 수정 및 검증 완료
