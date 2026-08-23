import { describe, it, expect } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import { ErrorCode } from '@quanlykhupho/shared-types';
import { getErrorCode, getErrorMessage } from '../src/lib/api-client';

describe('Web API Client & Error Parsing', () => {
  it('should extract message from standard Error', () => {
    const error = new Error('Lỗi kết nối mạng');
    expect(getErrorMessage(error)).toBe('Lỗi kết nối mạng');
  });

  it('should extract error message and errorCode from Axios response envelope', () => {
    const axiosError = new AxiosError(
      'Request failed with status code 400',
      'ERR_BAD_REQUEST',
      undefined,
      undefined,
      {
        data: {
          success: false,
          statusCode: 400,
          message: 'Mã OTP không chính xác. Còn lại 2 lần thử.',
          errorCode: ErrorCode.INVALID_OTP,
          timestamp: new Date().toISOString(),
        },
        status: 400,
        statusText: 'Bad Request',
        headers: {},
        config: { headers: new AxiosHeaders() },
      },
    );

    expect(getErrorMessage(axiosError)).toBe(
      'Mã OTP không chính xác. Còn lại 2 lần thử.',
    );
    expect(getErrorCode(axiosError)).toBe(ErrorCode.INVALID_OTP);
  });

  it('should return fallback message for unknown error types', () => {
    expect(getErrorMessage(null)).toBe('Đã có lỗi không xác định xảy ra');
    expect(getErrorMessage(12345)).toBe('Đã có lỗi không xác định xảy ra');
  });
});
