import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import * as fs from 'fs';
import {
  AnnouncementDetailDto,
  AnnouncementDto,
  AnnouncementFeedResponseDto,
  CommentDto,
  UserDto,
} from '@quanlykhupho/shared-types';
import { AuthGuard } from '../security/guards/auth.guard';
import { CurrentUser } from '../security/decorators/current-user.decorator';
import { AnnouncementsService } from './announcements.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { ModerateCommentDto } from './dto/moderate-comment.dto';
import { AnnouncementFeedQueryDto } from './dto/announcement-feed-query.dto';

@Controller('announcements')
@UseGuards(AuthGuard)
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Get()
  async getFeed(
    @CurrentUser() user: UserDto,
    @Query() query: AnnouncementFeedQueryDto,
  ): Promise<AnnouncementFeedResponseDto> {
    return this.announcementsService.getFeed(user, query);
  }

  @Get(':id')
  async getDetail(
    @Param('id') id: string,
    @CurrentUser() user: UserDto,
  ): Promise<AnnouncementDetailDto> {
    return this.announcementsService.getDetail(id, user);
  }

  @Post()
  @UseInterceptors(
    FilesInterceptor('files', 5, {
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async create(
    @CurrentUser() user: UserDto,
    @Body() dto: CreateAnnouncementDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ): Promise<AnnouncementDto> {
    return this.announcementsService.create(user, dto, files);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @CurrentUser() user: UserDto,
    @Body() dto: UpdateAnnouncementDto,
  ): Promise<AnnouncementDto> {
    return this.announcementsService.update(id, user, dto);
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: UserDto,
  ): Promise<{ success: boolean; message: string }> {
    return this.announcementsService.remove(id, user);
  }

  @Get(':id/attachments/:attachmentId')
  async downloadAttachment(
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @CurrentUser() user: UserDto,
    @Res() res: Response,
  ): Promise<void> {
    const attachment = await this.announcementsService.downloadAttachment(
      id,
      attachmentId,
      user,
    );

    // Set secure download headers with encoded filename (RFC 5987)
    const encodedFilename = encodeURIComponent(attachment.originalName);
    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader('Content-Length', attachment.fileSize);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${attachment.originalName.replace(/"/g, '')}"; filename*=UTF-8''${encodedFilename}`,
    );

    const stream = fs.createReadStream(attachment.filePath);
    stream.pipe(res);
  }

  @Post(':id/comments')
  async createComment(
    @Param('id') id: string,
    @CurrentUser() user: UserDto,
    @Body() dto: CreateCommentDto,
  ): Promise<CommentDto> {
    return this.announcementsService.createComment(id, user, dto);
  }

  @Patch(':id/comments/:commentId/moderate')
  async moderateComment(
    @Param('id') id: string,
    @Param('commentId') commentId: string,
    @CurrentUser() user: UserDto,
    @Body() dto: ModerateCommentDto,
  ): Promise<CommentDto> {
    return this.announcementsService.moderateComment(id, commentId, user, dto);
  }
}
