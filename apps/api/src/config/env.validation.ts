import { plainToInstance, Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, Max, Min, validateSync } from 'class-validator';
import { isIP } from 'node:net';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export enum SmsProviderType {
  Webhook = 'webhook',
  Memory = 'memory',
}

export class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  PORT: number = 4000;

  @IsString()
  @IsOptional()
  CORS_ORIGIN: string = 'http://localhost:3000';

  @IsString()
  @IsOptional()
  TRUST_PROXY: string = 'loopback';

  @IsString()
  @IsOptional()
  DATABASE_URL?: string;

  @IsString()
  @IsOptional()
  REDIS_URL?: string;

  @IsString()
  @IsOptional()
  RABBITMQ_URL?: string;

  @IsString()
  @IsOptional()
  PHONE_ENCRYPTION_KEY?: string;

  @IsString()
  @IsOptional()
  PHONE_HASH_KEY?: string;

  @IsString()
  @IsOptional()
  OTP_PEPPER?: string;

  @IsString()
  @IsOptional()
  SMS_QUEUE_ENCRYPTION_KEY?: string;

  @IsEnum(SmsProviderType)
  @IsOptional()
  SMS_PROVIDER?: SmsProviderType;

  @IsString()
  @IsOptional()
  SMS_PROVIDER_WEBHOOK_URL?: string;

  @IsString()
  @IsOptional()
  SMS_PROVIDER_API_KEY?: string;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  SMS_PROVIDER_TIMEOUT_MS: number = 5000;

  @Type(() => Number)
  @IsNumber()
  @Min(100)
  @Max(5000)
  @IsOptional()
  HEALTH_PROBE_TIMEOUT_MS: number = 1000;

  @IsString()
  @IsOptional()
  BOOTSTRAP_OFFICER_PHONE?: string;

  @IsString()
  @IsOptional()
  BOOTSTRAP_OFFICER_FULL_NAME?: string;

  @IsString()
  @IsOptional()
  UPLOAD_DIR?: string;

  @IsString()
  @IsOptional()
  VAPID_PUBLIC_KEY?: string;

  @IsString()
  @IsOptional()
  VAPID_PRIVATE_KEY?: string;

  @IsString()
  @IsOptional()
  VAPID_SUBJECT?: string;
}

export function validateEnvironment(config: Record<string, unknown>): EnvironmentVariables {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(`Environment validation failed:\n${errors.toString()}`);
  }

  // Validate coherent VAPID configuration if any VAPID key is provided
  const hasAnyVapid = Boolean(
    validatedConfig.VAPID_PUBLIC_KEY ||
      validatedConfig.VAPID_PRIVATE_KEY ||
      validatedConfig.VAPID_SUBJECT,
  );
  if (hasAnyVapid) {
    const missingVapid: string[] = [];
    if (!validatedConfig.VAPID_PUBLIC_KEY) missingVapid.push('VAPID_PUBLIC_KEY');
    if (!validatedConfig.VAPID_PRIVATE_KEY) missingVapid.push('VAPID_PRIVATE_KEY');
    if (!validatedConfig.VAPID_SUBJECT) missingVapid.push('VAPID_SUBJECT');
    if (missingVapid.length > 0) {
      throw new Error(`Incomplete VAPID configuration: missing ${missingVapid.join(', ')}`);
    }
    if (
      validatedConfig.VAPID_SUBJECT &&
      !validatedConfig.VAPID_SUBJECT.startsWith('mailto:') &&
      !validatedConfig.VAPID_SUBJECT.startsWith('https://')
    ) {
      throw new Error('VAPID_SUBJECT must start with "mailto:" or "https://"');
    }
  }

  if (validatedConfig.NODE_ENV === Environment.Production) {
    const requiredValues: Array<[string, string | undefined]> = [
      ['DATABASE_URL', validatedConfig.DATABASE_URL],
      ['REDIS_URL', validatedConfig.REDIS_URL],
      ['RABBITMQ_URL', validatedConfig.RABBITMQ_URL],
      ['PHONE_ENCRYPTION_KEY', validatedConfig.PHONE_ENCRYPTION_KEY],
      ['PHONE_HASH_KEY', validatedConfig.PHONE_HASH_KEY],
      ['OTP_PEPPER', validatedConfig.OTP_PEPPER],
      ['SMS_QUEUE_ENCRYPTION_KEY', validatedConfig.SMS_QUEUE_ENCRYPTION_KEY],
    ];
    const missing = requiredValues.filter(([, value]) => !value).map(([name]) => name);
    if (missing.length > 0) {
      throw new Error(`Production environment is missing required configuration: ${missing.join(', ')}`);
    }

    if (
      validatedConfig.SMS_QUEUE_ENCRYPTION_KEY &&
      (validatedConfig.SMS_QUEUE_ENCRYPTION_KEY.length !== 64 ||
        !/^[0-9a-fA-F]+$/.test(validatedConfig.SMS_QUEUE_ENCRYPTION_KEY))
    ) {
      throw new Error('SMS_QUEUE_ENCRYPTION_KEY must be exactly 64 hexadecimal characters in production');
    }

    const provider = validatedConfig.SMS_PROVIDER || SmsProviderType.Webhook;
    if (provider === SmsProviderType.Memory) {
      throw new Error('In-memory SMS provider is forbidden in production environment');
    }

    if (provider === SmsProviderType.Webhook) {
      const webhookMissing: string[] = [];
      if (!validatedConfig.SMS_PROVIDER_WEBHOOK_URL) {
        webhookMissing.push('SMS_PROVIDER_WEBHOOK_URL');
      }
      if (!validatedConfig.SMS_PROVIDER_API_KEY) {
        webhookMissing.push('SMS_PROVIDER_API_KEY');
      }
      if (webhookMissing.length > 0) {
        throw new Error(
          `Production environment requires webhook provider configuration: ${webhookMissing.join(', ')}`,
        );
      }

      if (
        validatedConfig.SMS_PROVIDER_WEBHOOK_URL &&
        !validatedConfig.SMS_PROVIDER_WEBHOOK_URL.startsWith('https://')
      ) {
        throw new Error('SMS_PROVIDER_WEBHOOK_URL must use HTTPS protocol in production');
      }
    }

    // Validate CORS origins in production
    const rawCors = validatedConfig.CORS_ORIGIN;
    if (!rawCors || rawCors.trim() === '') {
      throw new Error('Production CORS_ORIGIN must be explicitly configured');
    }
    const corsOrigins = rawCors
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);

    if (corsOrigins.length === 0) {
      throw new Error('Production CORS_ORIGIN must contain at least one valid origin');
    }

    for (const origin of corsOrigins) {
      if (origin === '*') {
        throw new Error('Production CORS_ORIGIN cannot be wildcard "*"');
      }
      let parsedOrigin: URL;
      try {
        parsedOrigin = new URL(origin);
      } catch {
        throw new Error(`Production CORS_ORIGIN contains invalid origin: "${origin}"`);
      }
      const isLocalhost =
        parsedOrigin.protocol === 'http:' &&
        ['localhost', '127.0.0.1', '::1'].includes(parsedOrigin.hostname);
      const isHttps = parsedOrigin.protocol === 'https:';

      if (
        (!isHttps && !isLocalhost) ||
        parsedOrigin.username !== '' ||
        parsedOrigin.password !== '' ||
        parsedOrigin.origin !== origin
      ) {
        throw new Error(
          `Production CORS_ORIGIN contains insecure non-HTTPS origin: "${origin}". Only HTTPS origins or explicit localhost development/test origins are permitted in production.`,
        );
      }
    }

    // Validate TRUST_PROXY in production
    if (
      validatedConfig.TRUST_PROXY !== undefined &&
      validatedConfig.TRUST_PROXY !== null &&
      validatedConfig.TRUST_PROXY.trim() !== ''
    ) {
      const trustProxy = validatedConfig.TRUST_PROXY.trim();
      const lower = trustProxy.toLowerCase();

      if (lower === 'true' || trustProxy === '*' || lower === 'all') {
        throw new Error(
          'TRUST_PROXY cannot be blanket true or wildcard in production. Specify a hop count (e.g. 1) or specific trusted subnet/IP (e.g. loopback).',
        );
      }

      if (!isValidTrustProxy(trustProxy)) {
        throw new Error(
          `Invalid TRUST_PROXY configuration in production: "${trustProxy}". Must be a hop count, trusted keyword (loopback, linklocal, uniquelocal), IP address, CIDR subnet, or false.`,
        );
      }
    }
  }
  return validatedConfig;
}

export function isValidTrustProxy(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  if (['false', '0', 'none', 'disabled'].includes(lower)) return true;
  if (/^\d+$/.test(trimmed)) {
    const num = parseInt(trimmed, 10);
    return num >= 0 && num <= 10;
  }
  const parts = trimmed.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return false;

  const validKeywords = new Set(['loopback', 'linklocal', 'uniquelocal']);
  return parts.every((part) => {
    const pLower = part.toLowerCase();
    if (validKeywords.has(pLower)) return true;

    const [address = '', prefix, extra] = part.split('/');
    if (extra !== undefined) return false;
    const version = isIP(address);
    if (version === 0) return false;
    if (prefix === undefined) return true;
    if (!/^\d+$/.test(prefix)) return false;
    const prefixLength = Number(prefix);
    return prefixLength >= 0 && prefixLength <= (version === 4 ? 32 : 128);
  });
}
