import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { ErrorCode } from '@quanlykhupho/shared-types';
import { AppException } from '../../core/exceptions/app.exception';
import { SESSION_COOKIE_NAME } from '../../core/constants';

@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly allowedOrigins: Set<string>;

  constructor(private readonly configService: ConfigService) {
    const corsOrigin = this.configService.get<string>(
      'CORS_ORIGIN',
      'http://localhost:3000',
    );
    const origins = corsOrigin
      .split(',')
      .map((o) => o.trim().toLowerCase())
      .filter(Boolean);

    if (this.configService.get<string>('NODE_ENV') !== 'production') {
      origins.push('http://localhost:3000', 'http://localhost:4000', 'http://127.0.0.1:3000');
    }
    this.allowedOrigins = new Set(origins);
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method.toUpperCase();

    // Safe read-only HTTP methods
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      return true;
    }

    const originHeader = request.headers.origin;
    const refererHeader = request.headers.referer;

    if (originHeader) {
      const originUrl = originHeader.trim().toLowerCase();
      if (!this.allowedOrigins.has(originUrl)) {
        throw new AppException(
          'Yêu cầu bị từ chối do nguồn gốc không hợp lệ (Origin CSRF validation failed)',
          HttpStatus.FORBIDDEN,
          ErrorCode.CSRF_ERROR,
        );
      }
    } else if (refererHeader) {
      try {
        const parsed = new URL(refererHeader);
        const originUrl = parsed.origin.toLowerCase();
        if (!this.allowedOrigins.has(originUrl)) {
          throw new AppException(
            'Yêu cầu bị từ chối do nguồn gốc không hợp lệ (Referer CSRF validation failed)',
            HttpStatus.FORBIDDEN,
            ErrorCode.CSRF_ERROR,
          );
        }
      } catch {
        throw new AppException(
          'Referer header không hợp lệ',
          HttpStatus.FORBIDDEN,
          ErrorCode.CSRF_ERROR,
        );
      }
    } else if (request.cookies?.[SESSION_COOKIE_NAME]) {
      throw new AppException(
        'Yêu cầu dùng phiên trình duyệt phải có Origin hoặc Referer hợp lệ.',
        HttpStatus.FORBIDDEN,
        ErrorCode.CSRF_ERROR,
      );
    }

    return true;
  }
}
