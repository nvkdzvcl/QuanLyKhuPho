import { describe, expect, it } from 'vitest';
import { Environment, SmsProviderType, validateEnvironment } from './env.validation';

describe('validateEnvironment', () => {
  it('allows local development fallbacks', () => {
    const config = validateEnvironment({ NODE_ENV: Environment.Development });

    expect(config.NODE_ENV).toBe(Environment.Development);
  });

  it('fails closed when production infrastructure or secrets are missing', () => {
    expect(() =>
      validateEnvironment({ NODE_ENV: Environment.Production }),
    ).toThrow(
      'Production environment is missing required configuration: DATABASE_URL, REDIS_URL, RABBITMQ_URL, PHONE_ENCRYPTION_KEY, PHONE_HASH_KEY, OTP_PEPPER, SMS_QUEUE_ENCRYPTION_KEY',
    );
  });

  it('fails closed when SMS_QUEUE_ENCRYPTION_KEY is invalid in production', () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: Environment.Production,
        DATABASE_URL: 'postgresql://...',
        REDIS_URL: 'redis://...',
        RABBITMQ_URL: 'amqp://...',
        PHONE_ENCRYPTION_KEY: 'a'.repeat(64),
        PHONE_HASH_KEY: 'b'.repeat(64),
        OTP_PEPPER: 'c'.repeat(32),
        SMS_QUEUE_ENCRYPTION_KEY: 'invalid_hex',
        SMS_PROVIDER_WEBHOOK_URL: 'https://sms.example.com/api',
        SMS_PROVIDER_API_KEY: 'secret_token',
      }),
    ).toThrow('SMS_QUEUE_ENCRYPTION_KEY must be exactly 64 hexadecimal characters in production');
  });

  it('fails closed when in-memory provider is configured in production', () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: Environment.Production,
        DATABASE_URL: 'postgresql://...',
        REDIS_URL: 'redis://...',
        RABBITMQ_URL: 'amqp://...',
        PHONE_ENCRYPTION_KEY: 'a'.repeat(64),
        PHONE_HASH_KEY: 'b'.repeat(64),
        OTP_PEPPER: 'c'.repeat(32),
        SMS_QUEUE_ENCRYPTION_KEY: 'd'.repeat(64),
        SMS_PROVIDER: SmsProviderType.Memory,
      }),
    ).toThrow('In-memory SMS provider is forbidden in production environment');
  });

  it('fails closed when webhook configuration is missing or not HTTPS in production', () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: Environment.Production,
        DATABASE_URL: 'postgresql://...',
        REDIS_URL: 'redis://...',
        RABBITMQ_URL: 'amqp://...',
        PHONE_ENCRYPTION_KEY: 'a'.repeat(64),
        PHONE_HASH_KEY: 'b'.repeat(64),
        OTP_PEPPER: 'c'.repeat(32),
        SMS_QUEUE_ENCRYPTION_KEY: 'd'.repeat(64),
      }),
    ).toThrow('Production environment requires webhook provider configuration: SMS_PROVIDER_WEBHOOK_URL, SMS_PROVIDER_API_KEY');

    expect(() =>
      validateEnvironment({
        NODE_ENV: Environment.Production,
        DATABASE_URL: 'postgresql://...',
        REDIS_URL: 'redis://...',
        RABBITMQ_URL: 'amqp://...',
        PHONE_ENCRYPTION_KEY: 'a'.repeat(64),
        PHONE_HASH_KEY: 'b'.repeat(64),
        OTP_PEPPER: 'c'.repeat(32),
        SMS_QUEUE_ENCRYPTION_KEY: 'd'.repeat(64),
        SMS_PROVIDER_WEBHOOK_URL: 'http://insecure-sms.example.com/api',
        SMS_PROVIDER_API_KEY: 'secret_token',
      }),
    ).toThrow('SMS_PROVIDER_WEBHOOK_URL must use HTTPS protocol in production');
  });

  it('passes validation when all production settings are valid', () => {
    const config = validateEnvironment({
      NODE_ENV: Environment.Production,
      DATABASE_URL: 'postgresql://...',
      REDIS_URL: 'redis://...',
      RABBITMQ_URL: 'amqp://...',
      PHONE_ENCRYPTION_KEY: 'a'.repeat(64),
      PHONE_HASH_KEY: 'b'.repeat(64),
      OTP_PEPPER: 'c'.repeat(32),
      SMS_QUEUE_ENCRYPTION_KEY: 'd'.repeat(64),
      SMS_PROVIDER_WEBHOOK_URL: 'https://sms.example.com/api',
      SMS_PROVIDER_API_KEY: 'secret_token',
    });

    expect(config.NODE_ENV).toBe(Environment.Production);
    expect(config.SMS_PROVIDER_TIMEOUT_MS).toBe(5000);
    expect(config.HEALTH_PROBE_TIMEOUT_MS).toBe(1000);
  });

  it('fails closed when production CORS_ORIGIN contains insecure external HTTP origins', () => {
    const validBase = {
      NODE_ENV: Environment.Production,
      DATABASE_URL: 'postgresql://...',
      REDIS_URL: 'redis://...',
      RABBITMQ_URL: 'amqp://...',
      PHONE_ENCRYPTION_KEY: 'a'.repeat(64),
      PHONE_HASH_KEY: 'b'.repeat(64),
      OTP_PEPPER: 'c'.repeat(32),
      SMS_QUEUE_ENCRYPTION_KEY: 'd'.repeat(64),
      SMS_PROVIDER_WEBHOOK_URL: 'https://sms.example.com/api',
      SMS_PROVIDER_API_KEY: 'secret_token',
    };

    expect(() =>
      validateEnvironment({
        ...validBase,
        CORS_ORIGIN: 'http://insecure-domain.com',
      }),
    ).toThrow('Production CORS_ORIGIN contains insecure non-HTTPS origin: "http://insecure-domain.com"');

    expect(() =>
      validateEnvironment({
        ...validBase,
        CORS_ORIGIN: 'https://secure.example.com, http://insecure.example.com',
      }),
    ).toThrow('Production CORS_ORIGIN contains insecure non-HTTPS origin: "http://insecure.example.com"');
  });

  it('fails closed when production CORS_ORIGIN is wildcard "*"', () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: Environment.Production,
        DATABASE_URL: 'postgresql://...',
        REDIS_URL: 'redis://...',
        RABBITMQ_URL: 'amqp://...',
        PHONE_ENCRYPTION_KEY: 'a'.repeat(64),
        PHONE_HASH_KEY: 'b'.repeat(64),
        OTP_PEPPER: 'c'.repeat(32),
        SMS_QUEUE_ENCRYPTION_KEY: 'd'.repeat(64),
        SMS_PROVIDER_WEBHOOK_URL: 'https://sms.example.com/api',
        SMS_PROVIDER_API_KEY: 'secret_token',
        CORS_ORIGIN: '*',
      }),
    ).toThrow('Production CORS_ORIGIN cannot be wildcard "*"');
  });

  it('allows production CORS_ORIGIN with HTTPS origins or explicit localhost origins', () => {
    const validBase = {
      NODE_ENV: Environment.Production,
      DATABASE_URL: 'postgresql://...',
      REDIS_URL: 'redis://...',
      RABBITMQ_URL: 'amqp://...',
      PHONE_ENCRYPTION_KEY: 'a'.repeat(64),
      PHONE_HASH_KEY: 'b'.repeat(64),
      OTP_PEPPER: 'c'.repeat(32),
      SMS_QUEUE_ENCRYPTION_KEY: 'd'.repeat(64),
      SMS_PROVIDER_WEBHOOK_URL: 'https://sms.example.com/api',
      SMS_PROVIDER_API_KEY: 'secret_token',
    };

    const config1 = validateEnvironment({
      ...validBase,
      CORS_ORIGIN: 'https://quanlykhupho.vn, https://admin.quanlykhupho.vn',
    });
    expect(config1.CORS_ORIGIN).toBe('https://quanlykhupho.vn, https://admin.quanlykhupho.vn');

    const config2 = validateEnvironment({
      ...validBase,
      CORS_ORIGIN: 'http://localhost:3000, http://127.0.0.1:3000',
    });
    expect(config2.CORS_ORIGIN).toBe('http://localhost:3000, http://127.0.0.1:3000');
  });

  it('fails closed when production TRUST_PROXY is blanket true or wildcard', () => {
    const validBase = {
      NODE_ENV: Environment.Production,
      DATABASE_URL: 'postgresql://...',
      REDIS_URL: 'redis://...',
      RABBITMQ_URL: 'amqp://...',
      PHONE_ENCRYPTION_KEY: 'a'.repeat(64),
      PHONE_HASH_KEY: 'b'.repeat(64),
      OTP_PEPPER: 'c'.repeat(32),
      SMS_QUEUE_ENCRYPTION_KEY: 'd'.repeat(64),
      SMS_PROVIDER_WEBHOOK_URL: 'https://sms.example.com/api',
      SMS_PROVIDER_API_KEY: 'secret_token',
    };

    expect(() =>
      validateEnvironment({
        ...validBase,
        TRUST_PROXY: 'true',
      }),
    ).toThrow('TRUST_PROXY cannot be blanket true or wildcard in production');

    expect(() =>
      validateEnvironment({
        ...validBase,
        TRUST_PROXY: '*',
      }),
    ).toThrow('TRUST_PROXY cannot be blanket true or wildcard in production');
  });

  it('fails closed when production TRUST_PROXY is invalid', () => {
    const validBase = {
      NODE_ENV: Environment.Production,
      DATABASE_URL: 'postgresql://...',
      REDIS_URL: 'redis://...',
      RABBITMQ_URL: 'amqp://...',
      PHONE_ENCRYPTION_KEY: 'a'.repeat(64),
      PHONE_HASH_KEY: 'b'.repeat(64),
      OTP_PEPPER: 'c'.repeat(32),
      SMS_QUEUE_ENCRYPTION_KEY: 'd'.repeat(64),
      SMS_PROVIDER_WEBHOOK_URL: 'https://sms.example.com/api',
      SMS_PROVIDER_API_KEY: 'secret_token',
    };

    expect(() =>
      validateEnvironment({
        ...validBase,
        TRUST_PROXY: 'untrusted_domain_name',
      }),
    ).toThrow('Invalid TRUST_PROXY configuration in production');

    expect(() =>
      validateEnvironment({
        ...validBase,
        TRUST_PROXY: '999.999.999.999',
      }),
    ).toThrow('Invalid TRUST_PROXY configuration in production');

    expect(() =>
      validateEnvironment({
        ...validBase,
        TRUST_PROXY: '10.0.0.0/99',
      }),
    ).toThrow('Invalid TRUST_PROXY configuration in production');
  });

  it('allows production TRUST_PROXY with hop counts, trusted keywords, subnets, or false', () => {
    const validBase = {
      NODE_ENV: Environment.Production,
      DATABASE_URL: 'postgresql://...',
      REDIS_URL: 'redis://...',
      RABBITMQ_URL: 'amqp://...',
      PHONE_ENCRYPTION_KEY: 'a'.repeat(64),
      PHONE_HASH_KEY: 'b'.repeat(64),
      OTP_PEPPER: 'c'.repeat(32),
      SMS_QUEUE_ENCRYPTION_KEY: 'd'.repeat(64),
      SMS_PROVIDER_WEBHOOK_URL: 'https://sms.example.com/api',
      SMS_PROVIDER_API_KEY: 'secret_token',
    };

    expect(validateEnvironment({ ...validBase, TRUST_PROXY: 'loopback' }).TRUST_PROXY).toBe('loopback');
    expect(validateEnvironment({ ...validBase, TRUST_PROXY: '1' }).TRUST_PROXY).toBe('1');
    expect(validateEnvironment({ ...validBase, TRUST_PROXY: '127.0.0.1, 10.0.0.0/8' }).TRUST_PROXY).toBe('127.0.0.1, 10.0.0.0/8');
    expect(validateEnvironment({ ...validBase, TRUST_PROXY: 'false' }).TRUST_PROXY).toBe('false');
  });

  it('validates HEALTH_PROBE_TIMEOUT_MS bounds', () => {
    const validConfig = validateEnvironment({
      NODE_ENV: Environment.Development,
      HEALTH_PROBE_TIMEOUT_MS: 2500,
    });
    expect(validConfig.HEALTH_PROBE_TIMEOUT_MS).toBe(2500);

    expect(() =>
      validateEnvironment({
        NODE_ENV: Environment.Development,
        HEALTH_PROBE_TIMEOUT_MS: 50,
      }),
    ).toThrow('Environment validation failed');

    expect(() =>
      validateEnvironment({
        NODE_ENV: Environment.Development,
        HEALTH_PROBE_TIMEOUT_MS: 50000,
      }),
    ).toThrow('Environment validation failed');
  });

  it('converts numeric string environment values for PORT, SMS_PROVIDER_TIMEOUT_MS, and HEALTH_PROBE_TIMEOUT_MS to numbers', () => {
    const config = validateEnvironment({
      NODE_ENV: Environment.Development,
      PORT: '4000',
      SMS_PROVIDER_TIMEOUT_MS: '5000',
      HEALTH_PROBE_TIMEOUT_MS: '1000',
    });

    expect(config.PORT).toBe(4000);
    expect(typeof config.PORT).toBe('number');
    expect(config.SMS_PROVIDER_TIMEOUT_MS).toBe(5000);
    expect(typeof config.SMS_PROVIDER_TIMEOUT_MS).toBe('number');
    expect(config.HEALTH_PROBE_TIMEOUT_MS).toBe(1000);
    expect(typeof config.HEALTH_PROBE_TIMEOUT_MS).toBe('number');
  });

  it('fails validation when numeric environment variables receive non-numeric strings', () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: Environment.Development,
        PORT: 'invalid_port',
      }),
    ).toThrow('Environment validation failed');

    expect(() =>
      validateEnvironment({
        NODE_ENV: Environment.Development,
        SMS_PROVIDER_TIMEOUT_MS: 'not_a_number',
      }),
    ).toThrow('Environment validation failed');

    expect(() =>
      validateEnvironment({
        NODE_ENV: Environment.Development,
        HEALTH_PROBE_TIMEOUT_MS: 'not_a_number',
      }),
    ).toThrow('Environment validation failed');
  });
});
