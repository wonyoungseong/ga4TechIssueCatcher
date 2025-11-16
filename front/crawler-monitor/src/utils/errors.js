/**
 * Error Handling Utilities
 */

export class ApiError extends Error {
  constructor(status, message, data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export function handleApiError(error) {
  if (error instanceof ApiError) {
    return {
      message: getUserFriendlyMessage(error),
      status: error.status,
      original: error,
    };
  }

  if (error.name === 'AbortError') {
    return {
      message: '요청 시간이 초과되었습니다.',
      status: 408,
      original: error,
    };
  }

  return {
    message: '알 수 없는 오류가 발생했습니다.',
    status: 500,
    original: error,
  };
}

function getUserFriendlyMessage(error) {
  const messages = {
    0: '인터넷 연결을 확인해주세요.',
    400: '잘못된 요청입니다.',
    401: '인증이 필요합니다.',
    403: '권한이 없습니다.',
    404: '요청한 리소스를 찾을 수 없습니다.',
    408: '요청 시간이 초과되었습니다.',
    409: '이미 진행 중인 작업이 있습니다.',
    500: '서버 오류가 발생했습니다.',
    502: '서버에 연결할 수 없습니다.',
    503: '서비스를 사용할 수 없습니다.',
  };

  return messages[error.status] || error.message || '알 수 없는 오류가 발생했습니다.';
}

export function logError(error, context = {}) {
  if (process.env.NODE_ENV === 'development') {
    console.error('[Error]', {
      message: error.message,
      status: error.status,
      context,
      stack: error.stack,
    });
  }
}
