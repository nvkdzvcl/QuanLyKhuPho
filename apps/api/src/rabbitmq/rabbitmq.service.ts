import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQService.name);
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;
  private isMemoryMode = false;
  private readonly isProduction: boolean;
  public readonly publishedMessages: Array<{ queue: string; content: string; timestamp: Date }> = [];

  constructor(private readonly configService: ConfigService) {
    this.isProduction = this.configService.get<string>('NODE_ENV') === 'production';
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

    try {
      this.connection = await amqp.connect(rabbitmqUrl);
      this.channel = await this.connection.createChannel();
      this.logger.log('Connected to RabbitMQ server');
    } catch (err) {
      if (this.isProduction) {
        this.logger.error('RabbitMQ connection failed');
        throw new Error('RabbitMQ connection failed', { cause: err });
      }
      this.logger.warn('RabbitMQ connection failed; using in-memory development fallback');
      this.isMemoryMode = true;
      this.connection = null;
      this.channel = null;
    }
  }

  async onModuleDestroy() {
    try {
      if (this.channel) await this.channel.close();
      if (this.connection) await this.connection.close();
    } catch {
      // ignore
    }
  }

  async publish(queueName: string, message: string): Promise<boolean> {
    if (this.channel && !this.isMemoryMode) {
      try {
        await this.channel.assertQueue(queueName, { durable: true });
        return this.channel.sendToQueue(queueName, Buffer.from(message), {
          persistent: true,
        });
      } catch (err) {
        if (this.isProduction) {
          this.logger.error('RabbitMQ publish failed');
          throw new Error('RabbitMQ publish failed', { cause: err });
        }
        this.logger.warn('RabbitMQ publish failed; using in-memory development fallback');
      }
    }

    this.publishedMessages.push({
      queue: queueName,
      content: message,
      timestamp: new Date(),
    });
    return true;
  }
}
