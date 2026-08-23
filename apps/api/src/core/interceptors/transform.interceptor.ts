import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponseEnvelope } from '@quanlykhupho/shared-types';

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponseEnvelope<T>>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponseEnvelope<T>> {
    return next.handle().pipe(
      map((data) => {
        // If data is already an envelope, return as is
        if (
          data &&
          typeof data === 'object' &&
          'success' in data &&
          'data' in data &&
          'timestamp' in data
        ) {
          return data;
        }

        return {
          success: true,
          data,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
