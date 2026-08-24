import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { AccountStatus } from '@quanlykhupho/shared-types';
import * as crypto from 'crypto';
import * as amqp from 'amqplib';
import {
  RabbitMQService,
  SMS_DLQ_NAME,
  SMS_QUEUE_NAME,
  SMS_RETRY_QUEUE_NAME,
} from './rabbitmq.service';
import { CryptoService } from '../security/crypto.service';
import { isValidPhoneNumber } from '../security/phone-utils';
import { RedisService } from '../redis/redis.service';
import { DevSmsInboxService } from './dev-sms-inbox.service';

export type SmsCommandType = 'OTP' | 'ACCOUNT_STATUS_UPDATE';

export interface EncryptedSmsEnvelope {
  version: 1;
  commandId: string;
  type: SmsCommandType;
  createdAt: string;
  encryptedPayload: string;
}

export interface SmsOtpPayload {
  type: 'OTP';
  phone: string;
  otp: string;
  createdAt: string;
}

export interface SmsStatusUpdatePayload {
  type: 'ACCOUNT_STATUS_UPDATE';
  phone: string;
  status: AccountStatus;
  reason?: string;
  createdAt: string;
}

export type SmsCommandPayload = SmsOtpPayload | SmsStatusUpdatePayload;

export interface SmsSendOptions {
  commandId: string;
  to: string;
  message: string;
}

export interface SmsSendResult {
  success: boolean;
  providerMessageId?: string;
}

export class SmsProviderTransientException extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly isTimeout = false,
  ) {
    super(message);
    this.name = 'SmsProviderTransientException';
  }
}

export class SmsProviderPermanentException extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'SmsProviderPermanentException';
  }
}

export interface ISmsProvider {
  sendSms(options: SmsSendOptions): Promise<SmsSendResult>;
}

export const SMS_PROVIDER_TOKEN = 'SMS_PROVIDER';

/**
 * Generic HTTPS Webhook SMS Provider without vendor SDK.
 * Bounded timeout, Bearer authentication, and Idempotency-Key header.
 */
export class WebhookSmsProvider implements ISmsProvider {
  private readonly webhookUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(webhookUrl: string, apiKey: string, timeoutMs = 5000, isProduction = false) {
    if (isProduction) {
      if (!webhookUrl || !webhookUrl.startsWith('https://')) {
        throw new Error('SMS_PROVIDER_WEBHOOK_URL must use HTTPS protocol in production');
      }
      if (!apiKey || apiKey.trim().length === 0) {
        throw new Error('SMS_PROVIDER_API_KEY is required in production');
      }
    }
    this.webhookUrl = webhookUrl;
    this.apiKey = apiKey;
    this.timeoutMs = timeoutMs;
  }

  async sendSms(options: SmsSendOptions): Promise<SmsSendResult> {
    const { commandId, to, message } = options;

    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          'Idempotency-Key': commandId,
        },
        body: JSON.stringify({
          to,
          message,
          commandId,
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (response.ok) {
        const providerMessageId = response.headers.get('x-message-id') || commandId;
        return { success: true, providerMessageId };
      }

      const status = response.status;
      if (status === 429 || status >= 500) {
        throw new SmsProviderTransientException(
          `Webhook provider returned transient HTTP status ${status}`,
          status,
        );
      }

      throw new SmsProviderPermanentException(
        `Webhook provider returned permanent HTTP status ${status}`,
        status,
      );
    } catch (err: unknown) {
      if (
        err instanceof SmsProviderTransientException ||
        err instanceof SmsProviderPermanentException
      ) {
        throw err;
      }

      const error = err as Error;
      if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
        throw new SmsProviderTransientException(
          'Webhook provider request timed out',
          undefined,
          true,
        );
      }

      throw new SmsProviderTransientException(
        `Webhook provider network error (${error?.name || 'FetchError'})`,
      );
    }
  }
}

/**
 * In-memory SMS provider for local testing and development without network calls.
 */
export class MemorySmsProvider implements ISmsProvider {
  public readonly sentMessages: Array<{
    commandId: string;
    to: string;
    message: string;
    timestamp: Date;
  }> = [];

  private simulateTransientError = false;
  private simulatePermanentError = false;
  private simulateSuccessFalse = false;

  setSimulateTransientError(value: boolean) {
    this.simulateTransientError = value;
  }

  setSimulatePermanentError(value: boolean) {
    this.simulatePermanentError = value;
  }

  setSimulateSuccessFalse(value: boolean) {
    this.simulateSuccessFalse = value;
  }

  async sendSms(options: SmsSendOptions): Promise<SmsSendResult> {
    if (this.simulateTransientError) {
      throw new SmsProviderTransientException('Simulated transient SMS provider failure', 503);
    }
    if (this.simulatePermanentError) {
      throw new SmsProviderPermanentException('Simulated permanent SMS provider failure', 400);
    }
    if (this.simulateSuccessFalse) {
      return { success: false };
    }

    this.sentMessages.push({
      commandId: options.commandId,
      to: options.to,
      message: options.message,
      timestamp: new Date(),
    });

    return { success: true, providerMessageId: `mem-${options.commandId}` };
  }

  clear() {
    this.sentMessages.length = 0;
    this.simulateTransientError = false;
    this.simulatePermanentError = false;
    this.simulateSuccessFalse = false;
  }
}

/**
 * Vietnamese SMS template rendering helpers.
 */
export function renderOtpTemplate(otp: string): string {
  return `[QuanLyKhuPho] Ma xac thuc (OTP) cua ban la: ${otp}. Ma co hieu luc trong 5 phut. Tuyet doi khong chia se ma nay cho bat ky ai.`;
}

export function renderAccountStatusTemplate(status: AccountStatus, reason?: string): string {
  switch (status) {
    case AccountStatus.ACTIVE:
      return '[QuanLyKhuPho] Tai khoan cua ban da duoc phe duyet thanh cong. Ban co the dang nhap vao he thong.';
    case AccountStatus.REJECTED:
      return `[QuanLyKhuPho] Yeu cau dang ky tai khoan cua ban da bi tu choi.${reason ? ` Ly do: ${reason}` : ''}`;
    case AccountStatus.LOCKED:
      return `[QuanLyKhuPho] Tai khoan cua ban da bi tam khoa.${reason ? ` Ly do: ${reason}` : ''}`;
    case AccountStatus.PENDING:
    default:
      return '[QuanLyKhuPho] Ho so cua ban dang o trang thai cho phe duyet.';
  }
}

export function renderSmsMessage(payload: SmsCommandPayload): string {
  if (payload.type === 'OTP') {
    return renderOtpTemplate(payload.otp);
  }
  if (payload.type === 'ACCOUNT_STATUS_UPDATE') {
    return renderAccountStatusTemplate(payload.status, payload.reason);
  }
  throw new Error('Unsupported command payload type');
}

@Injectable()
export class SmsPublisherService {
  private readonly logger = new Logger(SmsPublisherService.name);

  constructor(
    private readonly rabbitmqService: RabbitMQService,
    private readonly cryptoService: CryptoService,
    @Optional()
    private readonly devSmsInboxService?: DevSmsInboxService,
  ) {}

  /**
   * Publishes a versioned encrypted OTP command to the message queue.
   * Plaintext phone numbers and OTP codes are encrypted with AES-256-GCM before queuing.
   */
  async publishOtpSms(normalizedPhone: string, otpCode: string): Promise<string> {
    const commandId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const payload: SmsOtpPayload = {
      type: 'OTP',
      phone: normalizedPhone,
      otp: otpCode,
      createdAt,
    };

    const encryptedPayload = this.cryptoService.encryptQueuePayload(
      payload as unknown as Record<string, unknown>,
    );

    const envelope: EncryptedSmsEnvelope = {
      version: 1,
      commandId,
      type: 'OTP',
      createdAt,
      encryptedPayload,
    };

    await this.rabbitmqService.publish(SMS_QUEUE_NAME, JSON.stringify(envelope));
    this.logger.log(`Published encrypted OTP SMS command to queue (commandId: ${commandId})`);

    // Capture in development-only OTP inbox after publish resolves successfully
    if (this.devSmsInboxService) {
      try {
        this.devSmsInboxService.recordOtp(
          commandId,
          normalizedPhone,
          otpCode,
          createdAt,
        );
      } catch {
        // Safe: development inbox recording should never disrupt publishOtpSms
      }
    }

    return commandId;
  }

  /**
   * Publishes a versioned encrypted account status update SMS notification command.
   */
  async publishStatusUpdateSms(
    normalizedPhone: string,
    status: AccountStatus,
    reason?: string,
  ): Promise<string> {
    const commandId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const payload: SmsStatusUpdatePayload = {
      type: 'ACCOUNT_STATUS_UPDATE',
      phone: normalizedPhone,
      status,
      reason,
      createdAt,
    };

    const encryptedPayload = this.cryptoService.encryptQueuePayload(
      payload as unknown as Record<string, unknown>,
    );

    const envelope: EncryptedSmsEnvelope = {
      version: 1,
      commandId,
      type: 'ACCOUNT_STATUS_UPDATE',
      createdAt,
      encryptedPayload,
    };

    await this.rabbitmqService.publish(SMS_QUEUE_NAME, JSON.stringify(envelope));
    this.logger.log(
      `Published encrypted account status SMS command to queue (commandId: ${commandId})`,
    );
    return commandId;
  }
}

export type WorkerOutcome =
  | 'DELIVERED'
  | 'IDEMPOTENT_DUPLICATE_ACKED'
  | 'RETRY_SCHEDULED'
  | 'MAX_RETRIES_EXCEEDED_TO_DLQ'
  | 'PERMANENT_FAILURE_TO_DLQ'
  | 'POISON_MESSAGE_TO_DLQ';

export interface ProcessMessageResult {
  outcome: WorkerOutcome;
  commandId: string;
  attempt: number;
}

@Injectable()
export class SmsWorkerService {
  private readonly logger = new Logger(SmsWorkerService.name);
  private consumerTag: string | null = null;
  private isConsuming = false;

  constructor(
    private readonly rabbitmqService: RabbitMQService,
    private readonly redisService: RedisService,
    private readonly cryptoService: CryptoService,
    @Optional()
    @Inject(SMS_PROVIDER_TOKEN)
    private readonly smsProvider: ISmsProvider = new MemorySmsProvider(),
  ) {}

  /**
   * Core message processor implementing idempotency, decryption, template rendering,
   * provider delivery, transient retry backoff, and DLQ handling.
   */
  async processRawMessage(
    rawContent: string | Buffer,
    headers?: Record<string, unknown>,
    ackFn?: () => void,
  ): Promise<ProcessMessageResult> {
    const rawString =
      typeof rawContent === 'string' ? rawContent : rawContent.toString('utf8');
    const currentAttempt = (headers?.['x-retry-count'] as number) || 0;

    // 1. Parse JSON envelope
    let envelope: EncryptedSmsEnvelope;
    try {
      envelope = JSON.parse(rawString) as EncryptedSmsEnvelope;
    } catch {
      await this.rabbitmqService.publish(SMS_DLQ_NAME, rawString, {
        headers: { ...headers, 'x-dlq-reason': 'JSON_PARSE_ERROR' },
      });
      if (ackFn) ackFn();
      this.logger.error('Malformed non-JSON message routed to DLQ');
      return { outcome: 'POISON_MESSAGE_TO_DLQ', commandId: 'malformed', attempt: currentAttempt };
    }

    // 2. Validate envelope schema
    if (
      !envelope ||
      envelope.version !== 1 ||
      typeof envelope.commandId !== 'string' ||
      !envelope.commandId ||
      !['OTP', 'ACCOUNT_STATUS_UPDATE'].includes(envelope.type) ||
      typeof envelope.encryptedPayload !== 'string' ||
      !envelope.encryptedPayload
    ) {
      await this.rabbitmqService.publish(SMS_DLQ_NAME, rawString, {
        headers: { ...headers, 'x-dlq-reason': 'INVALID_ENVELOPE_SCHEMA' },
      });
      if (ackFn) ackFn();
      this.logger.error(`Invalid envelope schema routed to DLQ (commandId: ${envelope?.commandId || 'unknown'})`);
      return {
        outcome: 'POISON_MESSAGE_TO_DLQ',
        commandId: envelope?.commandId || 'unknown',
        attempt: currentAttempt,
      };
    }

    const commandId = envelope.commandId;
    const idempotencyKey = `sms:idempotent:${commandId}`;

    // 3. Redis-backed atomic expiring processing claim (SET NX EX for 60 seconds)
    const CLAIM_TTL_SECONDS = 60;
    const claimed = await this.redisService.setNxEx(
      idempotencyKey,
      JSON.stringify({
        status: 'PROCESSING',
        startedAt: new Date().toISOString(),
      }),
      CLAIM_TTL_SECONDS,
    );

    if (!claimed) {
      // Key already exists in Redis: inspect existing status
      const existingRecordRaw = await this.redisService.get(idempotencyKey);
      let existingRecord: { status?: string } | null = null;
      try {
        existingRecord = existingRecordRaw ? JSON.parse(existingRecordRaw) : null;
      } catch {
        existingRecord = null;
      }

      if (existingRecord?.status === 'COMPLETED') {
        this.logger.log(`Idempotent duplicate command already processed (commandId: ${commandId})`);
        if (ackFn) ackFn();
        return {
          outcome: 'IDEMPOTENT_DUPLICATE_ACKED',
          commandId,
          attempt: currentAttempt,
        };
      }

      // In-progress claim by another worker (status === 'PROCESSING')
      // Do not drop the command; schedule retry so it is safely re-evaluated after claim completes or expires
      this.logger.warn(
        `Command is currently being processed by another worker; scheduling retry (commandId: ${commandId})`,
      );
      await this.rabbitmqService.publish(SMS_RETRY_QUEUE_NAME, rawString, {
        headers: { ...headers, 'x-retry-count': currentAttempt },
      });
      if (ackFn) ackFn();
      return {
        outcome: 'RETRY_SCHEDULED',
        commandId,
        attempt: currentAttempt,
      };
    }

    // 4. Decrypt payload
    let payload: SmsCommandPayload;
    try {
      payload = this.cryptoService.decryptQueuePayload<SmsCommandPayload>(
        envelope.encryptedPayload,
      );
    } catch {
      await this.redisService.del(idempotencyKey);
      await this.rabbitmqService.publish(SMS_DLQ_NAME, rawString, {
        headers: { ...headers, 'x-dlq-reason': 'DECRYPTION_FAILED' },
      });
      if (ackFn) ackFn();
      this.logger.error(`Decryption failed; routed to DLQ (commandId: ${commandId})`);
      return {
        outcome: 'POISON_MESSAGE_TO_DLQ',
        commandId,
        attempt: currentAttempt,
      };
    }

    // 5. Strict payload schema validation
    const isPayloadValid =
      payload &&
      payload.type === envelope.type &&
      typeof payload.phone === 'string' &&
      isValidPhoneNumber(payload.phone) &&
      (payload.type === 'OTP'
        ? typeof payload.otp === 'string' && /^\d{6}$/.test(payload.otp)
        : Object.values(AccountStatus).includes(payload.status));

    if (!isPayloadValid) {
      await this.redisService.del(idempotencyKey);
      await this.rabbitmqService.publish(SMS_DLQ_NAME, rawString, {
        headers: { ...headers, 'x-dlq-reason': 'INVALID_PAYLOAD_SCHEMA' },
      });
      if (ackFn) ackFn();
      this.logger.error(`Invalid decrypted payload schema; routed to DLQ (commandId: ${commandId})`);
      return {
        outcome: 'POISON_MESSAGE_TO_DLQ',
        commandId,
        attempt: currentAttempt,
      };
    }

    // 6. Render Vietnamese SMS template
    const renderedMessage = renderSmsMessage(payload);

    // 7. Invoke SMS provider
    try {
      const sendResult = await this.smsProvider.sendSms({
        commandId,
        to: payload.phone,
        message: renderedMessage,
      });

      if (!sendResult || !sendResult.success) {
        throw new SmsProviderPermanentException('SMS provider returned success=false');
      }

      // Save idempotency record with 24 hours TTL
      await this.redisService.setex(
        idempotencyKey,
        86400,
        JSON.stringify({
          status: 'COMPLETED',
          completedAt: new Date().toISOString(),
          providerMessageId: sendResult.providerMessageId,
        }),
      );

      if (ackFn) ackFn();
      this.logger.log(
        `SMS command delivered successfully (commandId: ${commandId}, type: ${envelope.type}, attempt: ${currentAttempt})`,
      );
      return {
        outcome: 'DELIVERED',
        commandId,
        attempt: currentAttempt,
      };
    } catch (err: unknown) {
      // Release processing claim before scheduling retry or DLQ
      await this.redisService.del(idempotencyKey);

      if (err instanceof SmsProviderPermanentException) {
        await this.rabbitmqService.publish(SMS_DLQ_NAME, rawString, {
          headers: { ...headers, 'x-dlq-reason': 'PERMANENT_PROVIDER_REJECTION' },
        });
        if (ackFn) ackFn();
        this.logger.error(`Permanent provider rejection; routed to DLQ (commandId: ${commandId})`);
        return {
          outcome: 'PERMANENT_FAILURE_TO_DLQ',
          commandId,
          attempt: currentAttempt,
        };
      }

      // Transient failure (HTTP 429/5xx, timeout, network error, or unexpected exception)
      if (currentAttempt < 3) {
        const nextAttempt = currentAttempt + 1;
        await this.rabbitmqService.publish(SMS_RETRY_QUEUE_NAME, rawString, {
          headers: { ...headers, 'x-retry-count': nextAttempt },
        });
        if (ackFn) ackFn();
        this.logger.warn(
          `Transient failure; scheduled retry attempt ${nextAttempt} (commandId: ${commandId})`,
        );
        return {
          outcome: 'RETRY_SCHEDULED',
          commandId,
          attempt: nextAttempt,
        };
      } else {
        await this.rabbitmqService.publish(SMS_DLQ_NAME, rawString, {
          headers: { ...headers, 'x-dlq-reason': 'MAX_RETRIES_EXCEEDED' },
        });
        if (ackFn) ackFn();
        this.logger.error(
          `Max retries (3) exceeded; routed to DLQ (commandId: ${commandId}, attempt: ${currentAttempt})`,
        );
        return {
          outcome: 'MAX_RETRIES_EXCEEDED_TO_DLQ',
          commandId,
          attempt: currentAttempt,
        };
      }
    }
  }

  /**
   * Starts listening on the durable RabbitMQ sms_commands queue.
   */
  async startConsumer(): Promise<void> {
    if (this.isConsuming) return;

    await this.rabbitmqService.assertTopology();
    const channel = this.rabbitmqService.getChannel();

    if (!channel || this.rabbitmqService.isInMemory()) {
      throw new Error(
        'Cannot start SMS worker: RabbitMQ channel is not connected or in memory mode',
      );
    }

    try {
      await channel.prefetch(10);
      const consumeReply = await channel.consume(
        SMS_QUEUE_NAME,
        async (msg: amqp.ConsumeMessage | null) => {
          if (!msg) return;
          try {
            await this.processRawMessage(
              msg.content,
              msg.properties.headers as Record<string, unknown> | undefined,
              () => channel.ack(msg),
            );
          } catch (err) {
            this.logger.error('Unhandled infrastructure error in SMS worker consumer', err);
            try {
              channel.nack(msg, false, true);
            } catch (nackErr) {
              this.logger.error('Failed to nack message', nackErr);
            }
          }
        },
        { noAck: false },
      );

      this.consumerTag = consumeReply.consumerTag;
      this.isConsuming = true;
      this.logger.log(`SMS worker consumer started (consumerTag: ${this.consumerTag})`);
    } catch (err) {
      this.logger.error('Failed to start SMS worker consumer', err);
      throw err;
    }
  }

  async stopConsumer(): Promise<void> {
    if (!this.isConsuming || !this.consumerTag) return;
    const channel = this.rabbitmqService.getChannel();
    if (channel) {
      try {
        await channel.cancel(this.consumerTag);
        this.logger.log('SMS worker consumer cancelled');
      } catch {
        // ignore
      }
    }
    this.isConsuming = false;
    this.consumerTag = null;
  }
}
