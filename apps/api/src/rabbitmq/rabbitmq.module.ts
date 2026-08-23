import { Global, Module } from '@nestjs/common';
import { RabbitMQService } from './rabbitmq.service';
import { SmsPublisherService } from './sms-publisher.service';
import { CryptoService } from '../security/crypto.service';

@Global()
@Module({
  providers: [RabbitMQService, SmsPublisherService, CryptoService],
  exports: [RabbitMQService, SmsPublisherService],
})
export class RabbitMQModule {}
