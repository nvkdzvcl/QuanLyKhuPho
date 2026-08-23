import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnvironment } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { RabbitMQModule } from './rabbitmq/rabbitmq.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { NeighborhoodsModule } from './neighborhoods/neighborhoods.module';
import { HealthModule } from './health/health.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AnnouncementsModule } from './announcements/announcements.module';
import { PetitionsModule } from './petitions/petitions.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
    }),
    PrismaModule,
    RedisModule,
    RabbitMQModule,
    AuthModule,
    UsersModule,
    NeighborhoodsModule,
    HealthModule,
    NotificationsModule,
    AnnouncementsModule,
    PetitionsModule,
  ],
})
export class AppModule {}
