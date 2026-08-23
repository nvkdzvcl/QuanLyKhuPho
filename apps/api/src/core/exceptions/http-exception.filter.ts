import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiErrorEnvelope, ErrorCode } from '@quanlykhupho/shared-types';
import { AppException } from './app.exception';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Đã có lỗi xảy ra từ hệ thống';
    let errorCode: ErrorCode | undefined = ErrorCode.INTERNAL_ERROR;
    let errors: string[] | undefined;

    if (exception instanceof AppException) {
      status = exception.getStatus();
      const res = exception.getResponse() as { message: string; errorCode?: ErrorCode; errors?: string[] };
      message = res.message || exception.message;
      errorCode = exception.errorCode || res.errorCode;
      errors = res.errors;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const obj = res as Record<string, unknown>;
        if (Array.isArray(obj.message)) {
          errors = obj.message.map((msg) => String(msg));
          message = errors[0] || 'Dữ liệu không hợp lệ';
          errorCode = ErrorCode.VALIDATION_ERROR;
        } else if (typeof obj.message === 'string') {
          message = obj.message;
        }
        if (obj.errorCode && typeof obj.errorCode === 'string') {
          errorCode = obj.errorCode as ErrorCode;
        }
      }
    } else if (exception instanceof Error) {
      this.logger.error(`Unhandled internal error (${exception.name})`);
    }

    const errorPayload: ApiErrorEnvelope = {
      success: false,
      statusCode: status,
      message,
      errorCode,
      timestamp: new Date().toISOString(),
      ...(errors && errors.length > 0 ? { errors } : {}),
    };

    response.status(status).json(errorPayload);
  }
}
