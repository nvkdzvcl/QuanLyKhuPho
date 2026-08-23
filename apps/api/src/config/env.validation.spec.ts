import { describe, expect, it } from 'vitest';
import { Environment, validateEnvironment } from './env.validation';

describe('validateEnvironment', () => {
  it('allows local development fallbacks', () => {
    const config = validateEnvironment({ NODE_ENV: Environment.Development });

    expect(config.NODE_ENV).toBe(Environment.Development);
  });

  it('fails closed when production infrastructure or secrets are missing', () => {
    expect(() =>
      validateEnvironment({ NODE_ENV: Environment.Production }),
    ).toThrow(
      'Production environment is missing required configuration: DATABASE_URL, REDIS_URL, RABBITMQ_URL, PHONE_ENCRYPTION_KEY, PHONE_HASH_KEY, OTP_PEPPER',
    );
  });
});
