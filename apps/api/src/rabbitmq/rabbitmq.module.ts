import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RabbitMQService } from './rabbitmq.service';
import {
  MemorySmsProvider,
  SMS_PROVIDER_TOKEN,
  SmsPublisherService,
  SmsWorkerService,
  WebhookSmsProvider,
} from './sms-publisher.service';
import { DevSmsInboxService } from './dev-sms-inbox.service';
import { DevSmsInboxController } from './dev-sms-inbox.controller';
import { CryptoService } from '../security/crypto.service';
import { RedisModule } from '../redis/redis.module';

@Global()
@Module({
  imports: [RedisModule],
  controllers: [DevSmsInboxController],
  providers: [
    RabbitMQService,
    DevSmsInboxService,
    SmsPublisherService,
    CryptoService,
    {
      provide: SMS_PROVIDER_TOKEN,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isProduction = config.get<string>('NODE_ENV') === 'production';
        const providerType =
          config.get<string>('SMS_PROVIDER') || (isProduction ? 'webhook' : 'memory');
        if (providerType === 'webhook') {
          const webhookUrl = config.get<string>('SMS_PROVIDER_WEBHOOK_URL') || '';
          const apiKey = config.get<string>('SMS_PROVIDER_API_KEY') || '';
          const timeoutMs = config.get<number>('SMS_PROVIDER_TIMEOUT_MS', 5000);
          return new WebhookSmsProvider(webhookUrl, apiKey, timeoutMs, isProduction);
        }
        return new MemorySmsProvider();
      },
    },
    SmsWorkerService,
  ],
  exports: [
    RabbitMQService,
    DevSmsInboxService,
    SmsPublisherService,
    SmsWorkerService,
    SMS_PROVIDER_TOKEN,
  ],
})
export class RabbitMQModule {}
