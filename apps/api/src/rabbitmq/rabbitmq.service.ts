import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';
import { ServiceHealth } from '@quanlykhupho/shared-types';

export const SMS_QUEUE_NAME = 'sms_commands';
export const SMS_DLQ_NAME = 'sms_commands_dlq';
export const SMS_RETRY_QUEUE_NAME = 'sms_commands_retry';
export const SMS_DLX_NAME = 'sms_commands_dlx';
export const SMS_RETRY_DELAY_MS = 5000;

export interface PublishedMessageRecord {
  queue: string;
  content: string;
  timestamp: Date;
  headers?: Record<string, unknown>;
}

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQService.name);
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.ConfirmChannel | amqp.Channel | null = null;
  private isMemoryMode = false;
  private readonly isProduction: boolean;
  private topologyAsserted = false;
  private isConnected = false;
  public readonly publishedMessages: PublishedMessageRecord[] = [];

  constructor(private readonly configService: ConfigService) {
    this.isProduction = this.configService.get<string>('NODE_ENV') === 'production';
  }

  protected openConnection(url: string): Promise<amqp.ChannelModel> {
    return amqp.connect(url);
  }

  async onModuleInit() {
    const rabbitmqUrl = this.configService.get<string>('RABBITMQ_URL');
    if (!rabbitmqUrl) {
      if (this.isProduction) {
        throw new Error('RabbitMQ configuration is required in production');
      }
      this.logger.warn('RABBITMQ_URL not configured; running in test/mock mode');
      this.isMemoryMode = true;
      return;
    }

    // Stage 1: Initial Connection Attempt
    try {
      this.connection = await this.openConnection(rabbitmqUrl);
      this.connection.once('close', () => {
        this.isConnected = false;
        this.topologyAsserted = false;
        this.channel = null;
        this.connection = null;
      });
      this.connection.on('error', () => {
        this.isConnected = false;
      });
    } catch (err) {
      if (this.isProduction) {
        this.logger.error('RabbitMQ connection failed');
        throw new Error('RabbitMQ connection failed', { cause: err });
      }
      this.logger.warn('RabbitMQ connection failed; using in-memory development fallback');
      this.isMemoryMode = true;
      this.connection = null;
      this.channel = null;
      return;
    }

    // Stage 2: Channel Creation & Topology Setup (connection established; failures must close and throw)
    try {
      this.channel = await this.connection.createConfirmChannel();
      this.channel.once('close', () => {
        this.isConnected = false;
        this.topologyAsserted = false;
        this.channel = null;
      });
      this.logger.log('Connected to RabbitMQ server with ConfirmChannel');
      await this.assertTopology();
      this.isConnected = true;
    } catch (err) {
      this.logger.error(
        'RabbitMQ channel creation or topology assertion failed after connection established',
        err,
      );
      try {
        if (this.channel) await this.channel.close();
      } catch {
        // ignore
      }
      try {
        if (this.connection) await this.connection.close();
      } catch {
        // ignore
      }
      this.channel = null;
      this.connection = null;
      this.isMemoryMode = false;
      this.isConnected = false;
      throw new Error(
        'Failed to establish RabbitMQ confirm channel or topology after connection was opened',
        { cause: err },
      );
    }
  }

  async onModuleDestroy() {
    this.isConnected = false;
    try {
      if (this.channel) await this.channel.close();
      if (this.connection) await this.connection.close();
    } catch {
      // ignore
    }
  }

  /**
   * Asserts durable exchanges, queues, and bindings for reliable SMS processing.
   */
  async assertTopology(): Promise<void> {
    if (this.isMemoryMode || this.topologyAsserted) {
      return;
    }

    if (!this.channel) {
      throw new Error('RabbitMQ channel is not available to assert topology');
    }

    try {
      // 1. Dead Letter Exchange (DLX)
      await this.channel.assertExchange(SMS_DLX_NAME, 'direct', { durable: true });

      // 2. Dead Letter Queue (DLQ)
      await this.channel.assertQueue(SMS_DLQ_NAME, { durable: true });
      await this.channel.bindQueue(SMS_DLQ_NAME, SMS_DLX_NAME, SMS_DLQ_NAME);

      // 3. Retry Queue with message TTL that routes back to main queue
      await this.channel.assertQueue(SMS_RETRY_QUEUE_NAME, {
        durable: true,
        arguments: {
          'x-message-ttl': SMS_RETRY_DELAY_MS,
          'x-dead-letter-exchange': '',
          'x-dead-letter-routing-key': SMS_QUEUE_NAME,
        },
      });

      // 4. Main queue with DLX routing on permanent reject / dead-letter
      await this.channel.assertQueue(SMS_QUEUE_NAME, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': SMS_DLX_NAME,
          'x-dead-letter-routing-key': SMS_DLQ_NAME,
        },
      });

      this.topologyAsserted = true;
      this.logger.log('RabbitMQ topology asserted successfully (main, retry, dlq)');
    } catch (err) {
      this.logger.error('Failed to assert RabbitMQ topology', err);
      throw new Error('Failed to assert RabbitMQ topology', { cause: err });
    }
  }

  /**
   * Publishes a persistent message with confirm channel support.
   * Never falls back to memory if a real channel was configured.
   */
  async publish(
    queueName: string,
    message: string,
    options?: amqp.Options.Publish,
  ): Promise<boolean> {
    if (this.isMemoryMode) {
      this.publishedMessages.push({
        queue: queueName,
        content: message,
        timestamp: new Date(),
        headers: options?.headers as Record<string, unknown> | undefined,
      });
      return true;
    }

    if (!this.channel) {
      throw new Error('RabbitMQ channel is not available for publishing');
    }

    await this.assertTopology();
    const confirmChannel = this.channel as amqp.ConfirmChannel;

    return new Promise<boolean>((resolve, reject) => {
      confirmChannel.sendToQueue(
        queueName,
        Buffer.from(message),
        { persistent: true, ...options },
        (err) => {
          if (err) {
            this.logger.error('RabbitMQ confirm publish failed', err);
            return reject(new Error('RabbitMQ confirm publish failed', { cause: err }));
          }
          resolve(true);
        },
      );
    });
  }

  getChannel(): amqp.ConfirmChannel | amqp.Channel | null {
    return this.channel;
  }

  getConnection(): amqp.ChannelModel | null {
    return this.connection;
  }

  isInMemory(): boolean {
    return this.isMemoryMode;
  }

  ping(): Promise<ServiceHealth> {
    const start = Date.now();
    if (this.isMemoryMode || !this.isConnected || !this.connection || !this.channel) {
      return Promise.resolve({
        status: this.isProduction ? 'down' : 'degraded',
        message: this.isProduction
          ? 'RabbitMQ connection unavailable'
          : 'In-memory fallback active (RabbitMQ is not connected)',
      });
    }

    return Promise.resolve({
      status: 'ok',
      latencyMs: Date.now() - start,
      message: 'RabbitMQ connection is healthy',
    });
  }
}
