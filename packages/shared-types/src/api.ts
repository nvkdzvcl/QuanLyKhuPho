import { ErrorCode } from './enums';

export interface ApiResponseEnvelope<T> {
  success: boolean;
  data: T;
  timestamp: string;
  message?: string;
}

export interface ApiErrorEnvelope {
  success: false;
  statusCode: number;
  message: string;
  errorCode?: ErrorCode;
  timestamp: string;
  errors?: string[];
}
