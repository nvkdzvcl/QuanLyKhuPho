import axios, { AxiosError } from 'axios';
import { ApiErrorEnvelope } from '@quanlykhupho/shared-types';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiErrorEnvelope>;
    if (axiosError.response?.data?.message) {
      return axiosError.response.data.message;
    }
    if (axiosError.message) {
      return axiosError.message;
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Đã có lỗi không xác định xảy ra';
}

export function getErrorCode(error: unknown): string | undefined {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiErrorEnvelope>;
    return axiosError.response?.data?.errorCode;
  }
  return undefined;
}
