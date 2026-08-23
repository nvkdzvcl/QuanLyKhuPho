import { plainToInstance } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, validateSync } from 'class-validator';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
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
    ];
    const missing = requiredValues.filter(([, value]) => !value).map(([name]) => name);
    if (missing.length > 0) {
      throw new Error(`Production environment is missing required configuration: ${missing.join(', ')}`);
    }
  }
  return validatedConfig;
}
