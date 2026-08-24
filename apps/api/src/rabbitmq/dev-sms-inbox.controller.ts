import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { DevSmsInboxItemDto } from '@quanlykhupho/shared-types';
import { DevSmsInboxService, isLoopbackAddress } from './dev-sms-inbox.service';
import { Public } from '../security/decorators/public.decorator';

@Controller('dev/sms-inbox')
export class DevSmsInboxController {
  constructor(private readonly devSmsInboxService: DevSmsInboxService) {}

  @Public()
  @Get()
  @HttpCode(HttpStatus.OK)
  getInbox(@Req() req: Request): DevSmsInboxItemDto[] {
    // Hidden (404) unless strictly in development + memory SMS provider mode
    if (!this.devSmsInboxService.isEnabled()) {
      throw new NotFoundException();
    }

    // Direct socket peer check only - forwarded headers are intentionally untrusted
    const socketRemoteAddress = req.socket?.remoteAddress;
    if (!isLoopbackAddress(socketRemoteAddress)) {
      throw new NotFoundException();
    }

    return this.devSmsInboxService.getInbox();
  }
}
