import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { OperationalMetricsService } from './operational-metrics.service';

@Injectable()
export class OperationalMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: OperationalMetricsService) {}

  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const startTime = Date.now();
    let isRecorded = false;

    const record = (isServerError: boolean) => {
      if (isRecorded) {
        return;
      }
      isRecorded = true;
      const durationMs = Math.max(0, Date.now() - startTime);
      this.metricsService.recordHttpRequest(durationMs, isServerError);
    };

    return next.handle().pipe(
      tap({
        next: () => {
          record(false);
        },
        error: (err: unknown) => {
          let isServerError = true;
          if (err instanceof HttpException) {
            const status = err.getStatus();
            isServerError = status >= HttpStatus.INTERNAL_SERVER_ERROR;
          } else if (
            err &&
            typeof err === 'object' &&
            'getStatus' in err &&
            typeof (err as { getStatus: unknown }).getStatus === 'function'
          ) {
            const status = (err as { getStatus: () => number }).getStatus();
            isServerError = status >= HttpStatus.INTERNAL_SERVER_ERROR;
          } else if (
            err &&
            typeof err === 'object' &&
            'status' in err &&
            typeof (err as { status: unknown }).status === 'number'
          ) {
            const status = (err as { status: number }).status;
            isServerError = status >= HttpStatus.INTERNAL_SERVER_ERROR;
          }
          record(isServerError);
        },
      }),
    );
  }
}
