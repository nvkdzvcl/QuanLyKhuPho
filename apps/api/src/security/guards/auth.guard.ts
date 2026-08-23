import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { AccountStatus, ErrorCode, UserDto, UserRole } from '@quanlykhupho/shared-types';
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
} from '../../core/constants';
import { AppException } from '../../core/exceptions/app.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { SessionData, SessionService } from '../../auth/session.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { CryptoService } from '../crypto.service';
import { maskPhoneNumber } from '../phone-utils';

export interface AuthenticatedRequest extends Request {
  user: UserDto;
  session: SessionData;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessionService: SessionService,
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request>();
    const response = httpContext.getResponse<Response>();
    const usesSessionCookie = Boolean(
      request.cookies?.[SESSION_COOKIE_NAME],
    );
    const sessionId = this.extractSessionId(request);

    if (!sessionId) {
      throw new AppException(
        'Vui lòng đăng nhập để tiếp tục (Chưa có phiên làm việc)',
        HttpStatus.UNAUTHORIZED,
        ErrorCode.UNAUTHORIZED,
      );
    }

    // 1. Retrieve session from Redis
    const session = await this.sessionService.getSession(sessionId);
    if (!session) {
      throw new AppException(
        'Phiên làm việc đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.',
        HttpStatus.UNAUTHORIZED,
        ErrorCode.UNAUTHORIZED,
      );
    }

    // 2. Re-check real-time account status from Database
    const account = await this.prisma.account.findUnique({
      where: { id: session.userId },
      include: { neighborhood: true },
    });

    if (!account) {
      await this.sessionService.destroySession(sessionId);
      throw new AppException(
        'Tài khoản không tồn tại hoặc đã bị xóa.',
        HttpStatus.UNAUTHORIZED,
        ErrorCode.ACCOUNT_NOT_FOUND,
      );
    }

    // Check account status: only active accounts can perform protected requests
    if (account.status !== 'active') {
      // Revoke all sessions for this non-active account
      await this.sessionService.revokeUserSessions(account.id);

      if (account.status === 'locked') {
        throw new AppException(
          `Tài khoản của bạn đã bị khóa.${account.lockReason ? ' Lý do: ' + account.lockReason : ''}`,
          HttpStatus.FORBIDDEN,
          ErrorCode.ACCOUNT_LOCKED,
        );
      } else if (account.status === 'rejected') {
        throw new AppException(
          `Tài khoản của bạn đã bị từ chối.${account.rejectionReason ? ' Lý do: ' + account.rejectionReason : ''}`,
          HttpStatus.FORBIDDEN,
          ErrorCode.ACCOUNT_REJECTED,
        );
      } else if (account.status === 'pending') {
        throw new AppException(
          'Tài khoản của bạn đang chờ phê duyệt từ Trưởng khu phố.',
          HttpStatus.FORBIDDEN,
          ErrorCode.ACCOUNT_PENDING,
        );
      }
    }

    // 3. Renew session TTL (sliding window)
    await this.sessionService.touchSession(sessionId);
    if (usesSessionCookie) {
      response.cookie(SESSION_COOKIE_NAME, sessionId, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        maxAge: SESSION_TTL_SECONDS * 1000,
      });
    }

    // 4. Attach safe user DTO to request (Never expose encrypted phone or hash)
    let maskedPhone = '***';
    try {
      if (account.phoneEncrypted) {
        const decrypted = this.cryptoService.decrypt(account.phoneEncrypted);
        maskedPhone = maskPhoneNumber(decrypted);
      }
    } catch {
      maskedPhone = '***';
    }

    const userDto: UserDto = {
      id: account.id,
      maskedPhone,
      fullName: account.fullName,
      role: account.role as unknown as UserRole,
      status: account.status as unknown as AccountStatus,
      address: account.address,
      neighborhoodId: account.neighborhoodId,
      neighborhood: account.neighborhood
        ? {
            id: account.neighborhood.id,
            code: account.neighborhood.code,
            name: account.neighborhood.name,
            ward: account.neighborhood.ward,
            district: account.neighborhood.district,
            city: account.neighborhood.city,
            description: account.neighborhood.description,
            createdAt: account.neighborhood.createdAt.toISOString(),
            updatedAt: account.neighborhood.updatedAt.toISOString(),
          }
        : null,
      rejectionReason: account.rejectionReason,
      lockReason: account.lockReason,
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString(),
    };

    const authReq = request as AuthenticatedRequest;
    authReq.user = userDto;
    authReq.session = session;

    return true;
  }

  private extractSessionId(request: Request): string | null {
    // 1. Try HttpOnly cookie
    if (request.cookies && request.cookies[SESSION_COOKIE_NAME]) {
      return request.cookies[SESSION_COOKIE_NAME];
    }

    // 2. Try Authorization Bearer header
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.slice(7).trim();
    }

    return null;
  }
}
