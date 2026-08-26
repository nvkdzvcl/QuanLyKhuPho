import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { of, throwError, lastValueFrom } from 'rxjs';
import { OperationalMetricsInterceptor } from './operational-metrics.interceptor';
import { OperationalMetricsService } from './operational-metrics.service';
import { AppException } from '../core/exceptions/app.exception';
import { ErrorCode } from '@quanlykhupho/shared-types';

describe('OperationalMetricsInterceptor', () => {
  let interceptor: OperationalMetricsInterceptor;
  let metricsService: OperationalMetricsService;
  let recordHttpRequestSpy: ReturnType<typeof vi.spyOn>;

  const mockExecutionContext = {
    switchToHttp: () => ({
      getRequest: () => ({
        url: '/api/sensitive/path',
        method: 'POST',
        headers: { authorization: 'Bearer secret_token' },
        body: { secretField: 'secret_value' },
      }),
      getResponse: () => ({
        statusCode: 200,
      }),
    }),
  } as unknown as ExecutionContext;

  beforeEach(() => {
    metricsService = new OperationalMetricsService();
    recordHttpRequestSpy = vi.spyOn(metricsService, 'recordHttpRequest');
    interceptor = new OperationalMetricsInterceptor(metricsService);
  });

  const getRecordedCall = (): [number, boolean] => {
    const call = recordHttpRequestSpy.mock.calls[0];
    if (
      !call ||
      typeof call[0] !== 'number' ||
      typeof call[1] !== 'boolean'
    ) {
      throw new Error('Expected one numeric HTTP duration and server-error flag');
    }
    return [call[0], call[1]];
  };

  describe('Success Path', () => {
    it('records duration and isServerError=false on successful execution without altering response', async () => {
      const responsePayload = { success: true, data: { id: '123' } };
      const callHandler: CallHandler = {
        handle: () => of(responsePayload),
      };

      const result$ = interceptor.intercept(mockExecutionContext, callHandler);
      const result = await lastValueFrom(result$);

      expect(result).toEqual(responsePayload);
      expect(recordHttpRequestSpy).toHaveBeenCalledTimes(1);

      const [durationMs, isServerError] = getRecordedCall();
      expect(typeof durationMs).toBe('number');
      expect(durationMs).toBeGreaterThanOrEqual(0);
      expect(isServerError).toBe(false);
    });
  });

  describe('Client Error Paths (4xx)', () => {
    it('records isServerError=false and propagates BadRequestException (400)', async () => {
      const exception = new BadRequestException('Invalid input format');
      const callHandler: CallHandler = {
        handle: () => throwError(() => exception),
      };

      await expect(
        lastValueFrom(interceptor.intercept(mockExecutionContext, callHandler)),
      ).rejects.toThrow(BadRequestException);

      expect(recordHttpRequestSpy).toHaveBeenCalledTimes(1);
      const [durationMs, isServerError] = getRecordedCall();
      expect(durationMs).toBeGreaterThanOrEqual(0);
      expect(isServerError).toBe(false);
    });

    it('records isServerError=false and propagates UnauthorizedException (401)', async () => {
      const exception = new UnauthorizedException('Missing credentials');
      const callHandler: CallHandler = {
        handle: () => throwError(() => exception),
      };

      await expect(
        lastValueFrom(interceptor.intercept(mockExecutionContext, callHandler)),
      ).rejects.toThrow(UnauthorizedException);

      expect(recordHttpRequestSpy).toHaveBeenCalledTimes(1);
      expect(getRecordedCall()[1]).toBe(false);
    });

    it('records isServerError=false and propagates ForbiddenException (403)', async () => {
      const exception = new ForbiddenException('Access denied');
      const callHandler: CallHandler = {
        handle: () => throwError(() => exception),
      };

      await expect(
        lastValueFrom(interceptor.intercept(mockExecutionContext, callHandler)),
      ).rejects.toThrow(ForbiddenException);

      expect(recordHttpRequestSpy).toHaveBeenCalledTimes(1);
      expect(getRecordedCall()[1]).toBe(false);
    });

    it('records isServerError=false and propagates NotFoundException (404)', async () => {
      const exception = new NotFoundException('Resource not found');
      const callHandler: CallHandler = {
        handle: () => throwError(() => exception),
      };

      await expect(
        lastValueFrom(interceptor.intercept(mockExecutionContext, callHandler)),
      ).rejects.toThrow(NotFoundException);

      expect(recordHttpRequestSpy).toHaveBeenCalledTimes(1);
      expect(getRecordedCall()[1]).toBe(false);
    });

    it('records isServerError=false for client AppException (400/401/403/404)', async () => {
      const appException = new AppException(
        'Tài khoản không hợp lệ',
        HttpStatus.FORBIDDEN,
        ErrorCode.FORBIDDEN,
      );
      const callHandler: CallHandler = {
        handle: () => throwError(() => appException),
      };

      await expect(
        lastValueFrom(interceptor.intercept(mockExecutionContext, callHandler)),
      ).rejects.toThrow(AppException);

      expect(recordHttpRequestSpy).toHaveBeenCalledTimes(1);
      expect(getRecordedCall()[1]).toBe(false);
    });
  });

  describe('Server Error Paths (5xx)', () => {
    it('records isServerError=true and propagates InternalServerErrorException (500)', async () => {
      const exception = new InternalServerErrorException('Database failure');
      const callHandler: CallHandler = {
        handle: () => throwError(() => exception),
      };

      await expect(
        lastValueFrom(interceptor.intercept(mockExecutionContext, callHandler)),
      ).rejects.toThrow(InternalServerErrorException);

      expect(recordHttpRequestSpy).toHaveBeenCalledTimes(1);
      const [durationMs, isServerError] = getRecordedCall();
      expect(durationMs).toBeGreaterThanOrEqual(0);
      expect(isServerError).toBe(true);
    });

    it('records isServerError=true and propagates ServiceUnavailableException (503)', async () => {
      const exception = new ServiceUnavailableException('Service temporarily overloaded');
      const callHandler: CallHandler = {
        handle: () => throwError(() => exception),
      };

      await expect(
        lastValueFrom(interceptor.intercept(mockExecutionContext, callHandler)),
      ).rejects.toThrow(ServiceUnavailableException);

      expect(recordHttpRequestSpy).toHaveBeenCalledTimes(1);
      expect(getRecordedCall()[1]).toBe(true);
    });

    it('records isServerError=true for server AppException (500/503)', async () => {
      const appException = new AppException(
        'Lỗi hệ thống',
        HttpStatus.SERVICE_UNAVAILABLE,
        ErrorCode.INTERNAL_ERROR,
      );
      const callHandler: CallHandler = {
        handle: () => throwError(() => appException),
      };

      await expect(
        lastValueFrom(interceptor.intercept(mockExecutionContext, callHandler)),
      ).rejects.toThrow(AppException);

      expect(recordHttpRequestSpy).toHaveBeenCalledTimes(1);
      expect(getRecordedCall()[1]).toBe(true);
    });

    it('records isServerError=true and propagates unhandled generic Error instances', async () => {
      const genericError = new Error('Unexpected runtime crash');
      const callHandler: CallHandler = {
        handle: () => throwError(() => genericError),
      };

      await expect(
        lastValueFrom(interceptor.intercept(mockExecutionContext, callHandler)),
      ).rejects.toThrow('Unexpected runtime crash');

      expect(recordHttpRequestSpy).toHaveBeenCalledTimes(1);
      expect(getRecordedCall()[1]).toBe(true);
    });
  });

  describe('Single-count and Privacy Invariants', () => {
    it('counts every intercepted request exactly once', async () => {
      const callHandler: CallHandler = {
        handle: () => of('single-result'),
      };

      await lastValueFrom(interceptor.intercept(mockExecutionContext, callHandler));
      expect(recordHttpRequestSpy).toHaveBeenCalledTimes(1);
    });

    it('never passes sensitive request or error payload arguments to metrics service', async () => {
      const sensitiveError = new Error('FATAL: password=supersecret at host 10.0.0.1');
      const callHandler: CallHandler = {
        handle: () => throwError(() => sensitiveError),
      };

      await expect(
        lastValueFrom(interceptor.intercept(mockExecutionContext, callHandler)),
      ).rejects.toThrow();

      expect(recordHttpRequestSpy).toHaveBeenCalledTimes(1);
      const args = getRecordedCall();

      // Ensure args only consist of [durationMs: number, isServerError: boolean]
      expect(args.length).toBe(2);
      expect(typeof args[0]).toBe('number');
      expect(typeof args[1]).toBe('boolean');
    });
  });
});
