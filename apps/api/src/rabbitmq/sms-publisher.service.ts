import { Injectable, Logger } from '@nestjs/common';
import { AccountStatus } from '@quanlykhupho/shared-types';
import { RabbitMQService } from './rabbitmq.service';
import { CryptoService } from '../security/crypto.service';

export const SMS_QUEUE_NAME = 'sms_commands';

export interface SmsOtpCommand {
  type: 'OTP';
  phone: string;
  otp: string;
  createdAt: string;
}

export interface SmsStatusUpdateCommand {
  type: 'ACCOUNT_STATUS_UPDATE';
  phone: string;
  status: AccountStatus;
  reason?: string;
  createdAt: string;
}

export type SmsCommand = SmsOtpCommand | SmsStatusUpdateCommand;

@Injectable()
export class SmsPublisherService {
  private readonly logger = new Logger(SmsPublisherService.name);

  constructor(
    private readonly rabbitmqService: RabbitMQService,
    private readonly cryptoService: CryptoService,
  ) {}

  /**
   * Publishes an encrypted OTP command to the message queue.
   * Plaintext phone numbers and OTP codes are encrypted with AES-256-GCM before queuing.
   */
  async publishOtpSms(normalizedPhone: string, otpCode: string): Promise<void> {
    const payload: SmsOtpCommand = {
      type: 'OTP',
      phone: normalizedPhone,
      otp: otpCode,
      createdAt: new Date().toISOString(),
    };

    const encryptedPayload = this.cryptoService.encryptQueuePayload(payload as unknown as Record<string, unknown>);
    const messageEnvelope = JSON.stringify({
      format: 'aes-256-gcm',
      encryptedData: encryptedPayload,
      timestamp: new Date().toISOString(),
    });

    await this.rabbitmqService.publish(SMS_QUEUE_NAME, messageEnvelope);
    this.logger.log('Published encrypted OTP SMS command to queue');
  }

  /**
   * Publishes an encrypted account status update SMS notification command.
   */
  async publishStatusUpdateSms(
    normalizedPhone: string,
    status: AccountStatus,
    reason?: string,
  ): Promise<void> {
    const payload: SmsStatusUpdateCommand = {
      type: 'ACCOUNT_STATUS_UPDATE',
      phone: normalizedPhone,
      status,
      reason,
      createdAt: new Date().toISOString(),
    };

    const encryptedPayload = this.cryptoService.encryptQueuePayload(payload as unknown as Record<string, unknown>);
    const messageEnvelope = JSON.stringify({
      format: 'aes-256-gcm',
      encryptedData: encryptedPayload,
      timestamp: new Date().toISOString(),
    });

    await this.rabbitmqService.publish(SMS_QUEUE_NAME, messageEnvelope);
    this.logger.log('Published encrypted account status SMS command to queue');
  }
}
