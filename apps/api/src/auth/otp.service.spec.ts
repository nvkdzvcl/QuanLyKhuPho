import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';
import { AccountStatus, ErrorCode } from '@quanlykhupho/shared-types';
import { AppException } from '../core/exceptions/app.exception';
import { RedisService } from '../redis/redis.service';
import {
  RabbitMQService,
  SMS_DLQ_NAME,
  SMS_QUEUE_NAME,
  SMS_RETRY_QUEUE_NAME,
} from '../rabbitmq/rabbitmq.service';
import {
  EncryptedSmsEnvelope,
  MemorySmsProvider,
  renderAccountStatusTemplate,
  renderOtpTemplate,
  renderSmsMessage,
  SmsPublisherService,
  SmsWorkerService,
  WebhookSmsProvider,
} from '../rabbitmq/sms-publisher.service';
import { CryptoService } from '../security/crypto.service';
import { OtpService } from './otp.service';

describe('OtpService', () => {
  let otpService: OtpService;
  let redisService: RedisService;
  let cryptoService: CryptoService;
  let smsPublisherService: SmsPublisherService;
  let rabbitmqService: RabbitMQService;

  beforeEach(async () => {
    const configService = {
      get: (key: string) => {
        if (key === 'PHONE_ENCRYPTION_KEY') {
          return '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
        }
        if (key === 'PHONE_HASH_KEY') {
          return 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';
        }
        if (key === 'OTP_PEPPER') {
          return 'test_otp_pepper_secret_key_32_bytes!';
        }
        if (key === 'SMS_QUEUE_ENCRYPTION_KEY') {
          return '1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff';
        }
        return undefined;
      },
    } as unknown as ConfigService;

    cryptoService = new CryptoService(configService);
    cryptoService.onModuleInit();

    redisService = new RedisService(configService);
    await redisService.onModuleInit();

    rabbitmqService = new RabbitMQService(configService);
    await rabbitmqService.onModuleInit();

    smsPublisherService = new SmsPublisherService(rabbitmqService, cryptoService);
    otpService = new OtpService(redisService, cryptoService, smsPublisherService);
  });

  describe('sendOtp & Rate Limiting', () => {
    it('should generate 6-digit OTP, store with 300s TTL, and publish encrypted SMS', async () => {
      otpService.setOtpGenerator(() => '654321');
      const phone = '+84912345678';

      const res = await otpService.sendOtp(phone);
      expect(res.expiresIn).toBe(300);
      expect(res.retryAfter).toBe(60);

      // Check stored OTP hash in Redis
      const phoneHash = cryptoService.hashPhone(phone);
      const storedHash = await redisService.get(`otp:hash:${phoneHash}`);
      expect(storedHash).toBe(cryptoService.hashOtp(phoneHash, '654321'));

      // Check published message in RabbitMQ queue
      expect(rabbitmqService.publishedMessages.length).toBe(1);
      const published = rabbitmqService.publishedMessages[0];
      expect(published?.queue).toBe('sms_commands');
      expect(published?.content).not.toContain('+84912345678');
      expect(published?.content).not.toContain('654321');
    });

    it('should clean up active OTP hash in Redis if queue publication fails, keeping rate limit intact', async () => {
      const phone = '+84912345678';
      const phoneHash = cryptoService.hashPhone(phone);

      // Force rabbitmq publish failure
      rabbitmqService.publish = async () => {
        throw new Error('Simulated queue outage');
      };

      await expect(otpService.sendOtp(phone)).rejects.toThrow('Simulated queue outage');

      // OTP hash must be removed so undeliverable code is not left active
      const storedHash = await redisService.get(`otp:hash:${phoneHash}`);
      expect(storedHash).toBeNull();

      // Rate limit must still count the attempt (count = 1)
      const rateLimitItem = await redisService.get(`otp:rate_limit:${phoneHash}`);
      expect(rateLimitItem).toBe('1');
    });

    it('should enforce 3 sends per 60 seconds rate limit (4th send throws RATE_LIMIT_EXCEEDED)', async () => {
      const phone = '+84912345678';

      // 1st, 2nd, 3rd sends succeed
      await expect(otpService.sendOtp(phone)).resolves.toBeDefined();
      await expect(otpService.sendOtp(phone)).resolves.toBeDefined();
      await expect(otpService.sendOtp(phone)).resolves.toBeDefined();

      // 4th send must be rejected with RATE_LIMIT_EXCEEDED
      try {
        await otpService.sendOtp(phone);
        expect.unreachable('Should have thrown RATE_LIMIT_EXCEEDED');
      } catch (err) {
        expect(err).toBeInstanceOf(AppException);
        expect((err as AppException).errorCode).toBe(ErrorCode.RATE_LIMIT_EXCEEDED);
      }
    });
  });

  describe('verifyOtp & Lockout', () => {
    it('should verify correct OTP and reset failed attempts and active hash', async () => {
      const phone = '+84912345678';
      otpService.setOtpGenerator(() => '112233');

      await otpService.sendOtp(phone);

      const isVerified = await otpService.verifyOtp(phone, '112233');
      expect(isVerified).toBe(true);

      const phoneHash = cryptoService.hashPhone(phone);
      const remainingHash = await redisService.get(`otp:hash:${phoneHash}`);
      expect(remainingHash).toBeNull();
    });

    it('should reject wrong OTP and trigger 15-minute lockout on the 3rd consecutive failed attempt', async () => {
      const phone = '+84912345678';
      otpService.setOtpGenerator(() => '998877');

      await otpService.sendOtp(phone);

      // Attempt 1: wrong OTP -> remaining attempts: 2
      await expect(otpService.verifyOtp(phone, '000000')).rejects.toThrow(
        AppException,
      );

      // Attempt 2: wrong OTP -> remaining attempts: 1
      await expect(otpService.verifyOtp(phone, '000001')).rejects.toThrow(
        AppException,
      );

      // Attempt 3: wrong OTP -> triggers 15-minute lockout
      try {
        await otpService.verifyOtp(phone, '000002');
        expect.unreachable('Should have thrown OTP_LOCKED');
      } catch (err) {
        expect(err).toBeInstanceOf(AppException);
        expect((err as AppException).errorCode).toBe(ErrorCode.OTP_LOCKED);
      }

      // Further verify attempts are locked
      try {
        await otpService.verifyOtp(phone, '998877');
        expect.unreachable('Should remain locked');
      } catch (err) {
        expect(err).toBeInstanceOf(AppException);
        expect((err as AppException).errorCode).toBe(ErrorCode.OTP_LOCKED);
      }
    });
  });

  describe('SMS Envelope & Publisher Invariants', () => {
    it('emits version 1 envelope with opaque UUID commandId without plaintext phone or OTP', async () => {
      const phone = '+84912345678';
      const otp = '889900';

      const commandId = await smsPublisherService.publishOtpSms(phone, otp);
      expect(commandId).toBeDefined();
      expect(typeof commandId).toBe('string');
      expect(commandId.length).toBeGreaterThan(10);

      const lastMsg = rabbitmqService.publishedMessages.at(-1);
      expect(lastMsg?.queue).toBe(SMS_QUEUE_NAME);

      const rawEnvelope = JSON.parse(lastMsg!.content) as EncryptedSmsEnvelope;
      expect(rawEnvelope.version).toBe(1);
      expect(rawEnvelope.commandId).toBe(commandId);
      expect(rawEnvelope.type).toBe('OTP');
      expect(rawEnvelope.createdAt).toBeDefined();
      expect(rawEnvelope.encryptedPayload).toBeDefined();

      // Serialized queue storage must NOT contain sensitive data
      expect(lastMsg!.content).not.toContain(phone);
      expect(lastMsg!.content).not.toContain(otp);
      expect(lastMsg!.content).not.toContain('Ma xac thuc');

      // Decryption recovers full payload
      const decrypted = cryptoService.decryptQueuePayload<{ type: string; phone: string; otp: string }>(
        rawEnvelope.encryptedPayload,
      );
      expect(decrypted.type).toBe('OTP');
      expect(decrypted.phone).toBe(phone);
      expect(decrypted.otp).toBe(otp);
    });

    it('emits version 1 envelope for ACCOUNT_STATUS_UPDATE without plaintext phone or reason', async () => {
      const phone = '+84912345678';
      const reason = 'Sai địa chỉ cư trú';

      const commandId = await smsPublisherService.publishStatusUpdateSms(
        phone,
        AccountStatus.REJECTED,
        reason,
      );

      const lastMsg = rabbitmqService.publishedMessages.at(-1);
      expect(lastMsg?.content).not.toContain(phone);
      expect(lastMsg?.content).not.toContain(reason);

      const rawEnvelope = JSON.parse(lastMsg!.content) as EncryptedSmsEnvelope;
      expect(rawEnvelope.version).toBe(1);
      expect(rawEnvelope.commandId).toBe(commandId);
      expect(rawEnvelope.type).toBe('ACCOUNT_STATUS_UPDATE');
    });
  });

  describe('WebhookSmsProvider', () => {
    it('enforces HTTPS and valid API key in production', () => {
      expect(() => {
        new WebhookSmsProvider('http://insecure.example.com/send', 'key123', 5000, true);
      }).toThrow('SMS_PROVIDER_WEBHOOK_URL must use HTTPS protocol in production');

      expect(() => {
        new WebhookSmsProvider('https://secure.example.com/send', '', 5000, true);
      }).toThrow('SMS_PROVIDER_API_KEY is required in production');
    });

    it('sends HTTP POST with Bearer auth, Idempotency-Key header, and documented JSON payload', async () => {
      let capturedRequest: { url: string; headers: Record<string, string>; body: Record<string, unknown> } | null = null;

      const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        capturedRequest = {
          url,
          headers: (init?.headers || {}) as Record<string, string>,
          body: JSON.parse((init?.body as string) || '{}') as Record<string, unknown>,
        };
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'x-message-id': 'msg-12345' }),
        };
      });

      vi.stubGlobal('fetch', mockFetch);

      const provider = new WebhookSmsProvider(
        'https://sms-gateway.example.com/api/send',
        'super_secret_token_123',
        5000,
        false,
      );

      const result = await provider.sendSms({
        commandId: 'cmd-999',
        to: '+84912345678',
        message: 'Ma xac thuc OTP cua ban la: 123456',
      });

      expect(result.success).toBe(true);
      expect(result.providerMessageId).toBe('msg-12345');
      const req = capturedRequest as unknown as {
        url: string;
        headers: Record<string, string>;
        body: Record<string, unknown>;
      };
      expect(req.url).toBe('https://sms-gateway.example.com/api/send');
      expect(req.headers['Authorization']).toBe('Bearer super_secret_token_123');
      expect(req.headers['Idempotency-Key']).toBe('cmd-999');
      expect(req.headers['Content-Type']).toBe('application/json');
      expect(req.body).toEqual({
        to: '+84912345678',
        message: 'Ma xac thuc OTP cua ban la: 123456',
        commandId: 'cmd-999',
      });

      vi.unstubAllGlobals();
    });

    it('classifies HTTP 429 and 5xx as transient errors and 4xx as permanent errors', async () => {
      const mockFetch = vi.fn();
      vi.stubGlobal('fetch', mockFetch);

      const provider = new WebhookSmsProvider(
        'https://sms-gateway.example.com/api/send',
        'key',
        5000,
        false,
      );

      // 503 Service Unavailable -> Transient
      mockFetch.mockResolvedValueOnce({ ok: false, status: 503 });
      await expect(
        provider.sendSms({ commandId: 'c1', to: '+84912345678', message: 'test' }),
      ).rejects.toMatchObject({ name: 'SmsProviderTransientException', statusCode: 503 });

      // 429 Rate Limit -> Transient
      mockFetch.mockResolvedValueOnce({ ok: false, status: 429 });
      await expect(
        provider.sendSms({ commandId: 'c2', to: '+84912345678', message: 'test' }),
      ).rejects.toMatchObject({ name: 'SmsProviderTransientException', statusCode: 429 });

      // 400 Bad Request -> Permanent
      mockFetch.mockResolvedValueOnce({ ok: false, status: 400 });
      await expect(
        provider.sendSms({ commandId: 'c3', to: '+84912345678', message: 'test' }),
      ).rejects.toMatchObject({ name: 'SmsProviderPermanentException', statusCode: 400 });

      // 401 Unauthorized -> Permanent
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
      await expect(
        provider.sendSms({ commandId: 'c4', to: '+84912345678', message: 'test' }),
      ).rejects.toMatchObject({ name: 'SmsProviderPermanentException', statusCode: 401 });

      vi.unstubAllGlobals();
    });
  });

  describe('Vietnamese Templates', () => {
    it('renders OTP template properly', () => {
      const text = renderOtpTemplate('654321');
      expect(text).toContain('654321');
      expect(text).toContain('5 phut');
      expect(text).toContain('[QuanLyKhuPho]');
    });

    it('renders Account Status templates for all status values', () => {
      expect(renderAccountStatusTemplate(AccountStatus.ACTIVE)).toContain('phe duyet thanh cong');
      expect(renderAccountStatusTemplate(AccountStatus.REJECTED, 'Thieu giay to')).toContain(
        'Thieu giay to',
      );
      expect(renderAccountStatusTemplate(AccountStatus.LOCKED, 'Tam khoa tai khoan')).toContain(
        'Tam khoa tai khoan',
      );
      expect(renderAccountStatusTemplate(AccountStatus.PENDING)).toContain('cho phe duyet');

      expect(
        renderSmsMessage({
          type: 'OTP',
          phone: '+84912345678',
          otp: '123456',
          createdAt: new Date().toISOString(),
        }),
      ).toContain('123456');
    });
  });

  describe('SmsWorkerService & Delivery Lifecycle', () => {
    let memoryProvider: MemorySmsProvider;
    let workerService: SmsWorkerService;

    beforeEach(() => {
      memoryProvider = new MemorySmsProvider();
      workerService = new SmsWorkerService(
        rabbitmqService,
        redisService,
        cryptoService,
        memoryProvider,
      );
    });

    it('processes fresh valid OTP message: delivers to provider, saves Redis idempotency, and acks', async () => {
      const phone = '+84912345678';
      const otp = '998877';
      const commandId = await smsPublisherService.publishOtpSms(phone, otp);

      const published = rabbitmqService.publishedMessages[0]!;
      let ackCalled = false;

      const result = await workerService.processRawMessage(
        published.content,
        undefined,
        () => {
          ackCalled = true;
        },
      );

      expect(result.outcome).toBe('DELIVERED');
      expect(result.commandId).toBe(commandId);
      expect(ackCalled).toBe(true);

      // Verify provider received message
      expect(memoryProvider.sentMessages.length).toBe(1);
      expect(memoryProvider.sentMessages[0]?.to).toBe(phone);
      expect(memoryProvider.sentMessages[0]?.message).toContain(otp);

      // Verify Redis idempotency saved
      const idempRecord = await redisService.get(`sms:idempotent:${commandId}`);
      expect(idempRecord).toBeDefined();
      expect(idempRecord).toContain('COMPLETED');
    });

    it('deduplicates redelivered completed command without calling provider again', async () => {
      const phone = '+84912345678';
      await smsPublisherService.publishOtpSms(phone, '123456');
      const published = rabbitmqService.publishedMessages[0]!;

      // First run: delivers
      await workerService.processRawMessage(published.content);
      expect(memoryProvider.sentMessages.length).toBe(1);

      // Second run (redelivery of same message): duplicate acknowledged without provider call
      let duplicateAckCalled = false;
      const dupResult = await workerService.processRawMessage(
        published.content,
        undefined,
        () => {
          duplicateAckCalled = true;
        },
      );

      expect(dupResult.outcome).toBe('IDEMPOTENT_DUPLICATE_ACKED');
      expect(duplicateAckCalled).toBe(true);
      expect(memoryProvider.sentMessages.length).toBe(1); // Not called again
    });

    it('safely handles concurrent in-progress processing claim without dropping command', async () => {
      const phone = '+84912345678';
      const commandId = await smsPublisherService.publishOtpSms(phone, '123456');
      const published = rabbitmqService.publishedMessages[0]!;

      // Manually set an in-progress processing claim in Redis
      await redisService.setex(
        `sms:idempotent:${commandId}`,
        60,
        JSON.stringify({ status: 'PROCESSING', startedAt: new Date().toISOString() }),
      );

      let ackCalled = false;
      const res = await workerService.processRawMessage(
        published.content,
        { 'x-retry-count': 1 },
        () => {
          ackCalled = true;
        },
      );

      expect(res.outcome).toBe('RETRY_SCHEDULED');
      expect(ackCalled).toBe(true);
      // Provider must not have been invoked
      expect(memoryProvider.sentMessages.length).toBe(0);
      // Retry message must have been published
      expect(rabbitmqService.publishedMessages.some((m) => m.queue === SMS_RETRY_QUEUE_NAME)).toBe(
        true,
      );
    });

    it('treats provider result with success=false as permanent failure routed to DLQ', async () => {
      await smsPublisherService.publishOtpSms('+84912345678', '123456');
      const published = rabbitmqService.publishedMessages[0]!;

      memoryProvider.setSimulateSuccessFalse(true);

      const res = await workerService.processRawMessage(published.content);
      expect(res.outcome).toBe('PERMANENT_FAILURE_TO_DLQ');
      expect(rabbitmqService.publishedMessages.some((m) => m.queue === SMS_DLQ_NAME)).toBe(true);
    });

    it('startConsumer throws when RabbitMQ channel is not connected or in memory mode', async () => {
      await expect(workerService.startConsumer()).rejects.toThrow(
        'Cannot start SMS worker: RabbitMQ channel is not connected or in memory mode',
      );
    });

    it('retries transient provider failure up to 3 times before routing to DLQ', async () => {
      const phone = '+84912345678';
      await smsPublisherService.publishOtpSms(phone, '123456');
      const published = rabbitmqService.publishedMessages[0]!;

      memoryProvider.setSimulateTransientError(true);

      // Attempt 1 (header retry-count undefined -> 0)
      const r1 = await workerService.processRawMessage(published.content, {});
      expect(r1.outcome).toBe('RETRY_SCHEDULED');
      expect(r1.attempt).toBe(1);
      expect(rabbitmqService.publishedMessages.some((m) => m.queue === SMS_RETRY_QUEUE_NAME)).toBe(
        true,
      );

      // Attempt 2 (header retry-count = 1)
      const r2 = await workerService.processRawMessage(published.content, { 'x-retry-count': 1 });
      expect(r2.outcome).toBe('RETRY_SCHEDULED');
      expect(r2.attempt).toBe(2);

      // Attempt 3 (header retry-count = 2)
      const r3 = await workerService.processRawMessage(published.content, { 'x-retry-count': 2 });
      expect(r3.outcome).toBe('RETRY_SCHEDULED');
      expect(r3.attempt).toBe(3);

      // Attempt 4 (header retry-count = 3 -> exceeds max retries)
      const r4 = await workerService.processRawMessage(published.content, { 'x-retry-count': 3 });
      expect(r4.outcome).toBe('MAX_RETRIES_EXCEEDED_TO_DLQ');
      expect(rabbitmqService.publishedMessages.some((m) => m.queue === SMS_DLQ_NAME)).toBe(true);
    });

    it('routes permanent provider failure immediately to DLQ', async () => {
      await smsPublisherService.publishOtpSms('+84912345678', '123456');
      const published = rabbitmqService.publishedMessages[0]!;

      memoryProvider.setSimulatePermanentError(true);

      const res = await workerService.processRawMessage(published.content);
      expect(res.outcome).toBe('PERMANENT_FAILURE_TO_DLQ');
      expect(rabbitmqService.publishedMessages.some((m) => m.queue === SMS_DLQ_NAME)).toBe(true);
    });

    it('routes poison messages (malformed JSON, tampered ciphertext, bad schema) directly to DLQ', async () => {
      // 1. Non-JSON
      const r1 = await workerService.processRawMessage('not-valid-json');
      expect(r1.outcome).toBe('POISON_MESSAGE_TO_DLQ');

      // 2. Bad envelope schema
      const r2 = await workerService.processRawMessage(JSON.stringify({ version: 2 }));
      expect(r2.outcome).toBe('POISON_MESSAGE_TO_DLQ');

      // 3. Tampered ciphertext (decryption fails)
      const r3 = await workerService.processRawMessage(
        JSON.stringify({
          version: 1,
          commandId: 'cmd-tampered',
          type: 'OTP',
          createdAt: new Date().toISOString(),
          encryptedPayload: '00:11:22',
        }),
      );
      expect(r3.outcome).toBe('POISON_MESSAGE_TO_DLQ');

      // 4. Invalid payload schema (non-vietnamese phone)
      const badPhonePayload = cryptoService.encryptQueuePayload({
        type: 'OTP',
        phone: '12345',
        otp: '123456',
        createdAt: new Date().toISOString(),
      });
      const r4 = await workerService.processRawMessage(
        JSON.stringify({
          version: 1,
          commandId: 'cmd-bad-phone',
          type: 'OTP',
          createdAt: new Date().toISOString(),
          encryptedPayload: badPhonePayload,
        }),
      );
      expect(r4.outcome).toBe('POISON_MESSAGE_TO_DLQ');
    });
  });

  describe('RabbitMQService Startup & Failure Safety', () => {
    it('throws in production when RABBITMQ_URL is missing', async () => {
      const prodConfig = {
        get: (key: string) => {
          if (key === 'NODE_ENV') return 'production';
          return undefined;
        },
      } as unknown as ConfigService;

      const service = new RabbitMQService(prodConfig);
      await expect(service.onModuleInit()).rejects.toThrow(
        'RabbitMQ configuration is required in production',
      );
    });

    it('throws and cleans up connection if createConfirmChannel or assertTopology fails after connection opened', async () => {
      let closeCalled = false;
      const fakeConnection = {
        createConfirmChannel: vi.fn().mockRejectedValue(new Error('Channel creation failed')),
        close: vi.fn().mockImplementation(async () => {
          closeCalled = true;
        }),
      } as unknown as amqp.ChannelModel;

      const devConfig = {
        get: (key: string) => {
          if (key === 'NODE_ENV') return 'development';
          if (key === 'RABBITMQ_URL') return 'amqp://localhost:5672';
          return undefined;
        },
      } as unknown as ConfigService;

      class TestRabbitMQService extends RabbitMQService {
        protected override openConnection(): Promise<amqp.ChannelModel> {
          return Promise.resolve(fakeConnection);
        }
      }

      const service = new TestRabbitMQService(devConfig);

      // Must throw and NOT switch to isMemoryMode
      await expect(service.onModuleInit()).rejects.toThrow(
        'Failed to establish RabbitMQ confirm channel or topology after connection was opened',
      );

      expect(service.isInMemory()).toBe(false);
      expect(service.getChannel()).toBeNull();
      expect(closeCalled).toBe(true);

    });
  });
});
