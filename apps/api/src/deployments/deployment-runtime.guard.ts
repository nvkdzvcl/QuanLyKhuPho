import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ErrorCode } from '@quanlykhupho/shared-types';
import { AppException } from '../core/exceptions/app.exception';
import { PrismaService } from '../prisma/prisma.service';
import { ALLOW_UNINITIALIZED_DEPLOYMENT_KEY } from './allow-uninitialized-deployment.decorator';

@Injectable()
export class DeploymentRuntimeGuard implements CanActivate {
  private readonly logger = new Logger(DeploymentRuntimeGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const nodeEnv =
      this.configService?.get<string>('NODE_ENV') ??
      process.env.NODE_ENV ??
      'development';

    // 1. Non-production environments (development & test) remain unblocked
    if (nodeEnv !== 'production') {
      return true;
    }

    // 2. Explicit exemption check (inspection & health endpoints)
    const isExempt = this.reflector.getAllAndOverride<boolean>(
      ALLOW_UNINITIALIZED_DEPLOYMENT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (isExempt) {
      return true;
    }

    // 3. In production, query database for confirmed singleton deployment profile
    let profile: { confirmed: boolean } | null;
    try {
      profile = await this.prisma.deploymentProfile.findUnique({
        where: { singletonKey: 'SINGLETON' },
        select: { confirmed: true },
      });
    } catch (err) {
      const errorName = err instanceof Error ? err.name : 'DatabaseError';
      this.logger.error(
        `Failed to verify deployment profile readiness (${errorName})`,
      );
      throw new AppException(
        'Dịch vụ chưa sẵn sàng để phục vụ yêu cầu (Lỗi kết nối cơ sở dữ liệu).',
        HttpStatus.SERVICE_UNAVAILABLE,
        ErrorCode.DEPLOYMENT_NOT_INITIALIZED,
      );
    }

    if (!profile) {
      throw new AppException(
        'Hệ thống chưa được khởi tạo hồ sơ triển khai.',
        HttpStatus.SERVICE_UNAVAILABLE,
        ErrorCode.DEPLOYMENT_NOT_INITIALIZED,
      );
    }

    if (!profile.confirmed) {
      throw new AppException(
        'Hồ sơ triển khai chưa được xác nhận.',
        HttpStatus.SERVICE_UNAVAILABLE,
        ErrorCode.DEPLOYMENT_NOT_INITIALIZED,
      );
    }

    return true;
  }
}
