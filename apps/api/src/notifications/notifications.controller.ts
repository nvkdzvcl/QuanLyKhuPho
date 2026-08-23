import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  NotificationListResponseDto,
  NotificationDto,
  UnreadCountResponseDto,
  UserDto,
  VapidPublicKeyResponseDto,
} from '@quanlykhupho/shared-types';
import { AuthGuard } from '../security/guards/auth.guard';
import { CurrentUser } from '../security/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
import {
  RegisterPushSubscriptionDto,
  UnregisterPushSubscriptionDto,
} from './dto/register-push.dto';

@Controller('notifications')
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getNotifications(
    @CurrentUser() user: UserDto,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<NotificationListResponseDto> {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.notificationsService.getNotifications(user.id, pageNum, limitNum);
  }

  @Get('unread-count')
  async getUnreadCount(
    @CurrentUser() user: UserDto,
  ): Promise<UnreadCountResponseDto> {
    return this.notificationsService.getUnreadCount(user.id);
  }

  @Patch(':id/read')
  async markAsRead(
    @CurrentUser() user: UserDto,
    @Param('id') id: string,
  ): Promise<NotificationDto> {
    return this.notificationsService.markAsRead(user.id, id);
  }

  @Post('mark-all-read')
  async markAllAsRead(
    @CurrentUser() user: UserDto,
  ): Promise<{ updatedCount: number }> {
    return this.notificationsService.markAllAsRead(user.id);
  }

  @Get('push/vapid-public-key')
  getVapidPublicKey(): VapidPublicKeyResponseDto {
    return this.notificationsService.getVapidPublicKey();
  }

  @Post('push/subscribe')
  async subscribePush(
    @CurrentUser() user: UserDto,
    @Body() dto: RegisterPushSubscriptionDto,
  ): Promise<{ success: boolean }> {
    return this.notificationsService.subscribePush(user.id, dto);
  }

  @Post('push/unsubscribe')
  async unsubscribePush(
    @CurrentUser() user: UserDto,
    @Body() dto: UnregisterPushSubscriptionDto,
  ): Promise<{ success: boolean }> {
    return this.notificationsService.unsubscribePush(user.id, dto.endpoint);
  }
}
