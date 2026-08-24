import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import {
  DevSmsInboxService,
  isLoopbackAddress,
  MAX_DEV_SMS_INBOX_SIZE,
  DEV_SMS_INBOX_TTL_MS,
} from './dev-sms-inbox.service';
import { DevSmsInboxController } from './dev-sms-inbox.controller';
import { SmsPublisherService } from './sms-publisher.service';
import { RabbitMQService } from './rabbitmq.service';
import { CryptoService } from '../security/crypto.service';

function createMockConfigService(
  nodeEnv = 'development',
  smsProvider = 'memory',
): ConfigService {
  return {
    get: vi.fn((key: string) => {
      if (key === 'NODE_ENV') return nodeEnv;
      if (key === 'SMS_PROVIDER') return smsProvider;
      if (key === 'SMS_QUEUE_ENCRYPTION_KEY') {
        return '1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff';
      }
      return undefined;
    }),
  } as unknown as ConfigService;
}

function createMockRequest(
  socketRemoteAddress?: string,
  forwardedFor?: string,
): Request {
  return {
    socket: {
      remoteAddress: socketRemoteAddress,
    },
    headers: {
      ...(forwardedFor ? { 'x-forwarded-for': forwardedFor } : {}),
    },
  } as unknown as Request;
}

describe('DevSmsInbox - Unit & Integration Tests', () => {
  describe('isLoopbackAddress Helper', () => {
    it('accepts valid loopback IPv4 and IPv6 addresses', () => {
      expect(isLoopbackAddress('127.0.0.1')).toBe(true);
      expect(isLoopbackAddress('::1')).toBe(true);
      expect(isLoopbackAddress('::ffff:127.0.0.1')).toBe(true);
      expect(isLoopbackAddress('127.0.0.2')).toBe(true);
      expect(isLoopbackAddress('::ffff:127.0.0.99')).toBe(true);
    });

    it('rejects remote addresses and empty values', () => {
      expect(isLoopbackAddress('192.168.1.10')).toBe(false);
      expect(isLoopbackAddress('10.0.0.1')).toBe(false);
      expect(isLoopbackAddress('203.0.113.195')).toBe(false);
      expect(isLoopbackAddress('::ffff:192.168.1.10')).toBe(false);
      expect(isLoopbackAddress('')).toBe(false);
      expect(isLoopbackAddress(undefined)).toBe(false);
      expect(isLoopbackAddress(null)).toBe(false);
    });
  });

  describe('DevSmsInboxService', () => {
    let service: DevSmsInboxService;

    beforeEach(() => {
      const config = createMockConfigService('development', 'memory');
      service = new DevSmsInboxService(config);
    });

    it('is enabled when NODE_ENV=development and SMS_PROVIDER=memory', () => {
      expect(service.isEnabled()).toBe(true);
    });

    it('is disabled when NODE_ENV is production or test', () => {
      const prodService = new DevSmsInboxService(
        createMockConfigService('production', 'memory'),
      );
      expect(prodService.isEnabled()).toBe(false);

      const testService = new DevSmsInboxService(
        createMockConfigService('test', 'memory'),
      );
      expect(testService.isEnabled()).toBe(false);
    });

    it('is disabled when SMS_PROVIDER is webhook, even in development', () => {
      const webhookService = new DevSmsInboxService(
        createMockConfigService('development', 'webhook'),
      );
      expect(webhookService.isEnabled()).toBe(false);
    });

    it('records OTP with masked phone and returns newest first', () => {
      service.recordOtp('cmd-1', '+84912345678', '111222', '2026-08-24T00:00:01Z');
      service.recordOtp('cmd-2', '+84987654321', '333444', '2026-08-24T00:00:02Z');

      const inbox = service.getInbox();
      expect(inbox.length).toBe(2);

      // Newest first
      expect(inbox[0]?.commandId).toBe('cmd-2');
      expect(inbox[0]?.maskedPhone).toBe('098***4321');
      expect(inbox[0]?.otpCode).toBe('333444');
      expect(inbox[0]?.createdAt).toBe('2026-08-24T00:00:02Z');

      expect(inbox[1]?.commandId).toBe('cmd-1');
      expect(inbox[1]?.maskedPhone).toBe('091***5678');
      expect(inbox[1]?.otpCode).toBe('111222');
      expect(inbox[1]?.createdAt).toBe('2026-08-24T00:00:01Z');
    });

    it('bounds history to exactly MAX_DEV_SMS_INBOX_SIZE (20) newest items', () => {
      for (let i = 1; i <= 25; i++) {
        service.recordOtp(`cmd-${i}`, '+84912345678', `10000${i % 10}`);
      }

      expect(service.count).toBe(MAX_DEV_SMS_INBOX_SIZE);
      const inbox = service.getInbox();
      expect(inbox.length).toBe(20);

      // Newest should be cmd-25, oldest should be cmd-6
      expect(inbox[0]?.commandId).toBe('cmd-25');
      expect(inbox[19]?.commandId).toBe('cmd-6');
    });

    it('returns a defensive copy to prevent external mutation', () => {
      service.recordOtp('cmd-1', '+84912345678', '123456');

      const copy1 = service.getInbox();
      copy1[0]!.otpCode = '999999';

      const copy2 = service.getInbox();
      expect(copy2[0]?.otpCode).toBe('123456');
    });

    it('removes OTP entries after the five-minute validity window', () => {
      vi.useFakeTimers();
      try {
        service.recordOtp('cmd-1', '+84912345678', '123456');
        vi.advanceTimersByTime(DEV_SMS_INBOX_TTL_MS);

        expect(service.getInbox()).toEqual([]);
        expect(service.count).toBe(0);
      } finally {
        vi.useRealTimers();
      }
    });

    it('does not store or return items when disabled', () => {
      const disabledService = new DevSmsInboxService(
        createMockConfigService('production', 'webhook'),
      );

      disabledService.recordOtp('cmd-prod', '+84912345678', '123456');
      expect(disabledService.getInbox()).toEqual([]);
      expect(disabledService.count).toBe(0);
    });
  });

  describe('DevSmsInboxController', () => {
    let service: DevSmsInboxService;
    let controller: DevSmsInboxController;

    beforeEach(() => {
      const config = createMockConfigService('development', 'memory');
      service = new DevSmsInboxService(config);
      controller = new DevSmsInboxController(service);
    });

    it('returns inbox data for loopback peer in development+memory mode', () => {
      service.recordOtp('cmd-1', '+84912345678', '123456');

      const req = createMockRequest('127.0.0.1');
      const result = controller.getInbox(req);

      expect(result.length).toBe(1);
      expect(result[0]?.commandId).toBe('cmd-1');
      expect(result[0]?.maskedPhone).toBe('091***5678');
      expect(result[0]?.otpCode).toBe('123456');
    });

    it('allows IPv6 loopback (::1) and IPv4-mapped loopback (::ffff:127.0.0.1)', () => {
      service.recordOtp('cmd-1', '+84912345678', '123456');

      const reqIpv6 = createMockRequest('::1');
      expect(controller.getInbox(reqIpv6).length).toBe(1);

      const reqMapped = createMockRequest('::ffff:127.0.0.1');
      expect(controller.getInbox(reqMapped).length).toBe(1);
    });

    it('throws NotFoundException (404) for non-loopback direct socket peer', () => {
      service.recordOtp('cmd-1', '+84912345678', '123456');

      const reqRemote = createMockRequest('192.168.1.100');
      expect(() => controller.getInbox(reqRemote)).toThrow(NotFoundException);

      const reqMissing = createMockRequest(undefined);
      expect(() => controller.getInbox(reqMissing)).toThrow(NotFoundException);
    });

    it('ignores x-forwarded-for header and rejects remote socket peer', () => {
      service.recordOtp('cmd-1', '+84912345678', '123456');

      // Spoofed x-forwarded-for header claiming 127.0.0.1
      const reqSpoofed = createMockRequest('203.0.113.195', '127.0.0.1');
      expect(() => controller.getInbox(reqSpoofed)).toThrow(NotFoundException);
    });

    it('throws NotFoundException (404) when inbox is disabled', () => {
      const prodConfig = createMockConfigService('production', 'webhook');
      const prodService = new DevSmsInboxService(prodConfig);
      const prodController = new DevSmsInboxController(prodService);

      const req = createMockRequest('127.0.0.1');
      expect(() => prodController.getInbox(req)).toThrow(NotFoundException);
    });
  });

  describe('SmsPublisherService & Dev Inbox Integration', () => {
    let rabbitmqService: RabbitMQService;
    let cryptoService: CryptoService;
    let devInboxService: DevSmsInboxService;
    let publisherService: SmsPublisherService;

    beforeEach(async () => {
      const config = createMockConfigService('development', 'memory');
      cryptoService = new CryptoService(config);
      cryptoService.onModuleInit();

      rabbitmqService = new RabbitMQService(config);
      await rabbitmqService.onModuleInit();

      devInboxService = new DevSmsInboxService(config);
      publisherService = new SmsPublisherService(
        rabbitmqService,
        cryptoService,
        devInboxService,
      );
    });

    it('captures OTP into dev inbox after successful RabbitMQ publish', async () => {
      const phone = '+84912345678';
      const otp = '654321';

      const commandId = await publisherService.publishOtpSms(phone, otp);
      expect(commandId).toBeDefined();

      const inbox = devInboxService.getInbox();
      expect(inbox.length).toBe(1);
      expect(inbox[0]?.commandId).toBe(commandId);
      expect(inbox[0]?.maskedPhone).toBe('091***5678');
      expect(inbox[0]?.otpCode).toBe(otp);
      expect(inbox[0]?.createdAt).toBeDefined();
    });

    it('does NOT capture OTP if RabbitMQ publish fails', async () => {
      rabbitmqService.publish = vi.fn().mockRejectedValue(new Error('Broker connection lost'));

      await expect(
        publisherService.publishOtpSms('+84912345678', '654321'),
      ).rejects.toThrow('Broker connection lost');

      expect(devInboxService.getInbox()).toEqual([]);
      expect(devInboxService.count).toBe(0);
    });

    it('does not retain OTP when devInboxService is disabled', async () => {
      const prodConfig = createMockConfigService('production', 'webhook');
      const prodInbox = new DevSmsInboxService(prodConfig);
      const prodPublisher = new SmsPublisherService(
        rabbitmqService,
        cryptoService,
        prodInbox,
      );

      await prodPublisher.publishOtpSms('+84912345678', '654321');
      expect(prodInbox.getInbox()).toEqual([]);
      expect(prodInbox.count).toBe(0);
    });
  });
});
