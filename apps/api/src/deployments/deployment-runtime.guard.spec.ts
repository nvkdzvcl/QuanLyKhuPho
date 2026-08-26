import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExecutionContext, HttpStatus, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ErrorCode } from '@quanlykhupho/shared-types';
import { AppException } from '../core/exceptions/app.exception';
import { PrismaService } from '../prisma/prisma.service';
import { DeploymentRuntimeGuard } from './deployment-runtime.guard';
import { AllowUninitializedDeployment } from './allow-uninitialized-deployment.decorator';

@AllowUninitializedDeployment()
class ExemptClassController {
  someEndpoint() {}
}

class StandardController {
  standardEndpoint() {}

  @AllowUninitializedDeployment()
  exemptEndpoint() {}
}

function createMockExecutionContext(options: {
  handler: object;
  classRef: object;
}): ExecutionContext {
  return {
    getHandler: () => options.handler,
    getClass: () => options.classRef,
    switchToHttp: () => ({
      getRequest: () => ({}),
      getResponse: () => ({}),
      getNext: () => ({}),
    }),
    getArgs: () => [],
    getArgByIndex: () => undefined,
    switchToRpc: () => ({
      getData: () => ({}),
      getContext: () => ({}),
    }),
    switchToWs: () => ({
      getClient: () => ({}),
      getData: () => ({}),
    }),
    getType: () => 'http',
  } as unknown as ExecutionContext;
}

describe('DeploymentRuntimeGuard', () => {
  let guard: DeploymentRuntimeGuard;
  let reflector: Reflector;
  let prismaService: {
    deploymentProfile: {
      findUnique: ReturnType<typeof vi.fn>;
    };
  };
  let configService: {
    get: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    reflector = new Reflector();
    prismaService = {
      deploymentProfile: {
        findUnique: vi.fn(),
      },
    };
    configService = {
      get: vi.fn(),
    };

    guard = new DeploymentRuntimeGuard(
      reflector,
      prismaService as unknown as PrismaService,
      configService as unknown as ConfigService,
    );
  });

  describe('Non-production Environments (Unblocked)', () => {
    it('allows business requests in development mode without database check', async () => {
      configService.get.mockReturnValue('development');

      const context = createMockExecutionContext({
        handler: StandardController.prototype.standardEndpoint,
        classRef: StandardController,
      });

      const canActivate = await guard.canActivate(context);

      expect(canActivate).toBe(true);
      expect(prismaService.deploymentProfile.findUnique).not.toHaveBeenCalled();
    });

    it('allows business requests in test mode without database check', async () => {
      configService.get.mockReturnValue('test');

      const context = createMockExecutionContext({
        handler: StandardController.prototype.standardEndpoint,
        classRef: StandardController,
      });

      const canActivate = await guard.canActivate(context);

      expect(canActivate).toBe(true);
      expect(prismaService.deploymentProfile.findUnique).not.toHaveBeenCalled();
    });

    it('allows business requests when NODE_ENV is unset without database check', async () => {
      configService.get.mockReturnValue(undefined);

      const context = createMockExecutionContext({
        handler: StandardController.prototype.standardEndpoint,
        classRef: StandardController,
      });

      const canActivate = await guard.canActivate(context);

      expect(canActivate).toBe(true);
      expect(prismaService.deploymentProfile.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('Exemptions via @AllowUninitializedDeployment', () => {
    it('allows access to controller decorated with @AllowUninitializedDeployment in production', async () => {
      configService.get.mockReturnValue('production');

      const context = createMockExecutionContext({
        handler: ExemptClassController.prototype.someEndpoint,
        classRef: ExemptClassController,
      });

      const canActivate = await guard.canActivate(context);

      expect(canActivate).toBe(true);
      expect(prismaService.deploymentProfile.findUnique).not.toHaveBeenCalled();
    });

    it('allows access to handler decorated with @AllowUninitializedDeployment in production', async () => {
      configService.get.mockReturnValue('production');

      const context = createMockExecutionContext({
        handler: StandardController.prototype.exemptEndpoint,
        classRef: StandardController,
      });

      const canActivate = await guard.canActivate(context);

      expect(canActivate).toBe(true);
      expect(prismaService.deploymentProfile.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('Production Business Requests (Guarded Boundary)', () => {
    const standardContext = createMockExecutionContext({
      handler: StandardController.prototype.standardEndpoint,
      classRef: StandardController,
    });

    it('blocks request with HTTP 503 and DEPLOYMENT_NOT_INITIALIZED when profile does not exist', async () => {
      configService.get.mockReturnValue('production');
      prismaService.deploymentProfile.findUnique.mockResolvedValue(null);

      let thrownError: unknown;
      try {
        await guard.canActivate(standardContext);
      } catch (err) {
        thrownError = err;
      }

      expect(thrownError).toBeInstanceOf(AppException);
      const appException = thrownError as AppException;
      expect(appException.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      expect(appException.errorCode).toBe(ErrorCode.DEPLOYMENT_NOT_INITIALIZED);
      expect(appException.message).toBe('Hệ thống chưa được khởi tạo hồ sơ triển khai.');
      expect(prismaService.deploymentProfile.findUnique).toHaveBeenCalledWith({
        where: { singletonKey: 'SINGLETON' },
        select: { confirmed: true },
      });
    });

    it('blocks request with HTTP 503 and DEPLOYMENT_NOT_INITIALIZED when profile is unconfirmed/draft', async () => {
      configService.get.mockReturnValue('production');
      prismaService.deploymentProfile.findUnique.mockResolvedValue({
        confirmed: false,
      });

      let thrownError: unknown;
      try {
        await guard.canActivate(standardContext);
      } catch (err) {
        thrownError = err;
      }

      expect(thrownError).toBeInstanceOf(AppException);
      const appException = thrownError as AppException;
      expect(appException.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      expect(appException.errorCode).toBe(ErrorCode.DEPLOYMENT_NOT_INITIALIZED);
      expect(appException.message).toBe('Hồ sơ triển khai chưa được xác nhận.');
    });

    it('allows request when profile exists and is confirmed in production', async () => {
      configService.get.mockReturnValue('production');
      prismaService.deploymentProfile.findUnique.mockResolvedValue({
        confirmed: true,
      });

      const canActivate = await guard.canActivate(standardContext);

      expect(canActivate).toBe(true);
      expect(prismaService.deploymentProfile.findUnique).toHaveBeenCalledWith({
        where: { singletonKey: 'SINGLETON' },
        select: { confirmed: true },
      });
    });

    it('fails closed with HTTP 503 on database connectivity failure without leaking sensitive info', async () => {
      configService.get.mockReturnValue('production');
      const sensitiveDbError = new Error(
        'FATAL: password authentication failed for user "postgres_admin" at host 10.0.0.1:5432',
      );
      prismaService.deploymentProfile.findUnique.mockRejectedValue(sensitiveDbError);

      const loggerSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

      let thrownError: unknown;
      try {
        await guard.canActivate(standardContext);
      } catch (err) {
        thrownError = err;
      }

      expect(thrownError).toBeInstanceOf(AppException);
      const appException = thrownError as AppException;
      expect(appException.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      expect(appException.errorCode).toBe(ErrorCode.DEPLOYMENT_NOT_INITIALIZED);
      expect(appException.message).not.toContain('postgres_admin');
      expect(appException.message).not.toContain('10.0.0.1');
      expect(appException.message).not.toContain('FATAL');

      // Verify logger recorded error name without leaking raw connection credentials
      expect(loggerSpy).toHaveBeenCalled();
      const loggedMessage = String(loggerSpy.mock.calls[0]?.[0] ?? '');
      expect(loggedMessage).not.toContain('postgres_admin');
      expect(loggedMessage).not.toContain('10.0.0.1');

      loggerSpy.mockRestore();
    });
  });
});
