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
  });
});
