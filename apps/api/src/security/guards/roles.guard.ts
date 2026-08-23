import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCode, UserRole } from '@quanlykhupho/shared-types';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AppException } from '../../core/exceptions/app.exception';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !requiredRoles.includes(user.role)) {
      throw new AppException(
        'Bạn không có quyền truy cập chức năng này (Quyền hạn không đủ)',
        HttpStatus.FORBIDDEN,
        ErrorCode.FORBIDDEN,
      );
    }

    return true;
  }
}
