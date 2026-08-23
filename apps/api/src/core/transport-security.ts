import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response, NextFunction, Express } from 'express';
import { ErrorCode } from '@quanlykhupho/shared-types';

/**
 * Hardens the NestJS API transport layer for production:
 * 1. Disables framework disclosure (X-Powered-By).
 * 2. Configures explicit proxy trust (e.g. hop count, loopback, IP subnets).
 * 3. Injects safe baseline security headers on every response.
 * 4. Conditionally sends HSTS only in production HTTPS context.
 * 5. Rejects every insecure plain HTTP request in production with 403 Forbidden.
 */
export function configureTransportSecurity(
  app: INestApplication,
  configService: ConfigService,
): void {
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  const isProduction = nodeEnv === 'production';
  const trustProxy = configService.get<string>('TRUST_PROXY');

  const expressApp = app.getHttpAdapter().getInstance() as Express;

  // 1. Remove framework disclosure at Express engine level
  if (expressApp && typeof expressApp.disable === 'function') {
    expressApp.disable('x-powered-by');
  }

  // 2. Configure proxy trust if Express engine is available
  if (
    expressApp &&
    typeof expressApp.set === 'function' &&
    trustProxy !== undefined &&
    trustProxy !== null &&
    trustProxy !== ''
  ) {
    const trimmed = String(trustProxy).trim();
    if (['false', '0', 'none', 'disabled'].includes(trimmed.toLowerCase())) {
      expressApp.set('trust proxy', false);
    } else if (/^\d+$/.test(trimmed)) {
      expressApp.set('trust proxy', parseInt(trimmed, 10));
    } else {
      expressApp.set('trust proxy', trimmed);
    }
  }

  // 3. Security headers and HTTPS enforcement middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Disable framework & server fingerprinting headers
    res.removeHeader('X-Powered-By');

    // Safe baseline security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

    const isSecure = req.secure || req.protocol === 'https';

    // HSTS only in production HTTPS context
    if (isProduction && isSecure) {
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains',
      );
    }

    // In production, every endpoint, including health probes, requires HTTPS.
    if (isProduction && !isSecure) {
      res.status(403).json({
        success: false,
        statusCode: 403,
        message: 'HTTPS connection is required',
        errorCode: ErrorCode.FORBIDDEN,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    next();
  });
}
