import { plainToInstance } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, validateSync } from 'class-validator';

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

  @IsNumber()
  @IsOptional()
  PORT: number = 4000;

  @IsString()
  @IsOptional()
  CORS_ORIGIN: string = 'http://localhost:3000';

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

  @IsNumber()
  @IsOptional()
  SMS_PROVIDER_TIMEOUT_MS: number = 5000;

  @IsString()
  @IsOptional()
  BOOTSTRAP_OFFICER_PHONE?: string;

  @IsString()
  @IsOptional()
  BOOTSTRAP_OFFICER_FULL_NAME?: string;
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
  }
  return validatedConfig;
}
