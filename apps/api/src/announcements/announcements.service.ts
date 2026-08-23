import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import {
  Account,
  Announcement,
  Attachment,
  Comment,
  Neighborhood,
  Prisma,
  AnnouncementScope as DbAnnouncementScope,
  AnnouncementStatus as DbAnnouncementStatus,
  AccountStatus as DbAccountStatus,
} from '@prisma/client';
import {
  AnnouncementDetailDto,
  AnnouncementDto,
  AnnouncementFeedQueryDto,
  AnnouncementFeedResponseDto,
  AnnouncementScope,
  AnnouncementStatus,
  CommentDto,
  CreateAnnouncementDto,
  CreateCommentDto,
  ErrorCode,
  ModerateCommentDto,
  NotificationType,
  UpdateAnnouncementDto,
  UserDto,
  UserRole,
} from '@quanlykhupho/shared-types';
import { AppException } from '../core/exceptions/app.exception';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  AttachmentStorageService,
  StoredAttachmentMetadata,
} from './attachment-storage.service';
import {
  validateUploadedFiles,
  ValidatedFile,
} from './file-signature.validator';

type FullAnnouncement = Announcement & {
  neighborhood: Neighborhood | null;
  author: Account;
  attachments: Attachment[];
  comments?: (Comment & { author: Account })[];
  _count?: {
    comments: number;
  };
};

@Injectable()
export class AnnouncementsService {
  private readonly logger = new Logger(AnnouncementsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly attachmentStorageService: AttachmentStorageService,
  ) {}

  /**
   * Formats database announcement into safe AnnouncementDto.
   */
  private formatAnnouncementDto(announcement: FullAnnouncement): AnnouncementDto {
    return {
      id: announcement.id,
      title: announcement.title,
      content: announcement.content,
      scope: announcement.scope as unknown as AnnouncementScope,
      status: announcement.status as unknown as AnnouncementStatus,
      neighborhoodId: announcement.neighborhoodId,
      neighborhood: announcement.neighborhood
        ? {
            id: announcement.neighborhood.id,
            code: announcement.neighborhood.code,
            name: announcement.neighborhood.name,
            ward: announcement.neighborhood.ward,
            district: announcement.neighborhood.district,
            city: announcement.neighborhood.city,
            description: announcement.neighborhood.description,
            createdAt: announcement.neighborhood.createdAt.toISOString(),
            updatedAt: announcement.neighborhood.updatedAt.toISOString(),
          }
        : null,
      authorId: announcement.authorId,
      author: {
        id: announcement.author.id,
        fullName: announcement.author.fullName,
        role: announcement.author.role as unknown as UserRole,
      },
      attachments: (announcement.attachments || []).map((att) => ({
        id: att.id,
        announcementId: att.announcementId,
        fileName: att.fileName,
        originalName: att.originalName,
        mimeType: att.mimeType,
        fileSize: att.fileSize,
        createdAt: att.createdAt.toISOString(),
      })),
      commentsCount:
        announcement._count?.comments ?? (announcement.comments ? announcement.comments.length : 0),
      createdAt: announcement.createdAt.toISOString(),
      updatedAt: announcement.updatedAt.toISOString(),
    };
  }

  /**
   * Helper to check visibility of an announcement for a specific user.
   */
  private canUserViewAnnouncement(
    announcement: {
      scope: DbAnnouncementScope;
      neighborhoodId: string | null;
      status: DbAnnouncementStatus;
      authorId: string;
    },
    user: UserDto,
  ): boolean {
    // If removed, only author or Officer can view
    if (announcement.status === DbAnnouncementStatus.removed) {
      return user.role === UserRole.OFFICER || announcement.authorId === user.id;
    }

    // Ward-wide announcement is visible to all active accounts
    if (announcement.scope === DbAnnouncementScope.ward) {
      return true;
    }

    // Neighborhood-scoped: Officer sees all; Resident/Leader must belong to the neighborhood
    if (user.role === UserRole.OFFICER) {
      return true;
    }

    return Boolean(user.neighborhoodId && user.neighborhoodId === announcement.neighborhoodId);
  }

  /**
   * Feed with filters, pagination, and server-side role/neighborhood isolation.
   */
  async getFeed(
    currentUser: UserDto,
    query: AnnouncementFeedQueryDto,
  ): Promise<AnnouncementFeedResponseDto> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const andConditions: Prisma.AnnouncementWhereInput[] = [
      { status: DbAnnouncementStatus.published },
    ];

    // Scoping rules based on user role
    if (
      currentUser.role === UserRole.RESIDENT ||
      currentUser.role === UserRole.LEADER
    ) {
      if (!currentUser.neighborhoodId) {
        // Unassigned user only sees ward announcements
        andConditions.push({ scope: DbAnnouncementScope.ward });
      } else {
        // Enforce user cannot request another neighborhood's feed
        if (query.neighborhoodId && query.neighborhoodId !== currentUser.neighborhoodId) {
          throw new AppException(
            'Bạn không có quyền xem thông báo của khu phố khác.',
            HttpStatus.FORBIDDEN,
            ErrorCode.FORBIDDEN,
          );
        }

        if (query.scope === AnnouncementScope.WARD) {
          andConditions.push({ scope: DbAnnouncementScope.ward });
        } else if (query.scope === AnnouncementScope.NEIGHBORHOOD) {
          andConditions.push({
            scope: DbAnnouncementScope.neighborhood,
            neighborhoodId: currentUser.neighborhoodId,
          });
        } else {
          // Both ward and own neighborhood
          andConditions.push({
            OR: [
              { scope: DbAnnouncementScope.ward },
              {
                scope: DbAnnouncementScope.neighborhood,
                neighborhoodId: currentUser.neighborhoodId,
              },
            ],
          });
        }
      }
    } else if (currentUser.role === UserRole.OFFICER) {
      if (query.scope) {
        andConditions.push({
          scope: query.scope as unknown as DbAnnouncementScope,
        });
      }
      if (query.neighborhoodId) {
        andConditions.push({ neighborhoodId: query.neighborhoodId });
      }
    }

    // Search query on title and content
    if (query.search && query.search.trim()) {
      const search = query.search.trim();
      andConditions.push({
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { content: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    const where: Prisma.AnnouncementWhereInput = { AND: andConditions };

    const [items, total] = await Promise.all([
      this.prisma.announcement.findMany({
        where,
        include: {
          neighborhood: true,
          author: true,
          attachments: true,
          _count: {
            select: { comments: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.announcement.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      items: items.map((item) => this.formatAnnouncementDto(item as FullAnnouncement)),
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Detail of a single announcement with attachments and chronological comments.
   */
  async getDetail(id: string, currentUser: UserDto): Promise<AnnouncementDetailDto> {
    const announcement = await this.prisma.announcement.findUnique({
      where: { id },
      include: {
        neighborhood: true,
        author: true,
        attachments: true,
        comments: {
          include: {
            author: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!announcement) {
      throw new AppException(
        'Không tìm thấy thông báo.',
        HttpStatus.NOT_FOUND,
        ErrorCode.ANNOUNCEMENT_NOT_FOUND,
      );
    }

    if (!this.canUserViewAnnouncement(announcement, currentUser)) {
      throw new AppException(
        'Bạn không có quyền xem thông báo này.',
        HttpStatus.FORBIDDEN,
        ErrorCode.FORBIDDEN,
      );
    }

    const isModerator =
      currentUser.role === UserRole.OFFICER ||
      (currentUser.role === UserRole.LEADER &&
        currentUser.neighborhoodId === announcement.neighborhoodId);

    const formattedComments: CommentDto[] = announcement.comments.map((c) => ({
      id: c.id,
      announcementId: c.announcementId,
      authorId: c.authorId,
      author: {
        id: c.author.id,
        fullName: c.author.fullName,
        role: c.author.role as unknown as UserRole,
        neighborhoodId: c.author.neighborhoodId,
      },
      content:
        c.isRemoved && !isModerator && c.authorId !== currentUser.id
          ? '[Bình luận này đã bị ẩn bởi ban quản trị]'
          : c.content,
      isRemoved: c.isRemoved,
      removedReason: isModerator || c.authorId === currentUser.id ? c.removedReason : null,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }));

    const baseDto = this.formatAnnouncementDto(announcement as FullAnnouncement);

    return {
      ...baseDto,
      comments: formattedComments,
    };
  }

  /**
   * Creates an announcement with optional attachments and transactional in-app notifications.
   * Cleans up staged files on disk if the transaction fails.
   */
  async create(
    currentUser: UserDto,
    dto: CreateAnnouncementDto,
    files?: Express.Multer.File[],
  ): Promise<AnnouncementDto> {
    // 1. Role authorization
    if (currentUser.role === UserRole.RESIDENT) {
      throw new AppException(
        'Cư dân không có quyền tạo thông báo.',
        HttpStatus.FORBIDDEN,
        ErrorCode.FORBIDDEN,
      );
    }

    let targetScope: DbAnnouncementScope;
    let targetNeighborhoodId: string | null = null;

    if (currentUser.role === UserRole.LEADER) {
      if (!currentUser.neighborhoodId) {
        throw new AppException(
          'Trưởng khu phố chưa được gán vào khu phố nào.',
          HttpStatus.FORBIDDEN,
          ErrorCode.FORBIDDEN,
        );
      }
      if (dto.scope === AnnouncementScope.WARD) {
        throw new AppException(
          'Trưởng khu phố chỉ được phép tạo thông báo trong phạm vi khu phố của mình.',
          HttpStatus.FORBIDDEN,
          ErrorCode.FORBIDDEN,
        );
      }
      targetScope = DbAnnouncementScope.neighborhood;
      targetNeighborhoodId = currentUser.neighborhoodId;
    } else if (currentUser.role === UserRole.OFFICER) {
      if (dto.scope === AnnouncementScope.WARD) {
        targetScope = DbAnnouncementScope.ward;
        targetNeighborhoodId = null;
      } else {
        targetScope = DbAnnouncementScope.neighborhood;
        if (!dto.neighborhoodId) {
          throw new AppException(
            'Vui lòng chọn khu phố cho thông báo cấp khu phố.',
            HttpStatus.BAD_REQUEST,
            ErrorCode.VALIDATION_ERROR,
          );
        }
        // Verify neighborhood exists
        const exists = await this.prisma.neighborhood.findUnique({
          where: { id: dto.neighborhoodId },
        });
        if (!exists) {
          throw new AppException(
            'Khu phố được chọn không tồn tại.',
            HttpStatus.NOT_FOUND,
            ErrorCode.NEIGHBORHOOD_NOT_FOUND,
          );
        }
        targetNeighborhoodId = dto.neighborhoodId;
      }
    } else {
      throw new AppException('Quyền hạn không hợp lệ.', HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN);
    }

    // 2. Validate uploaded attachments (count, size, signature allowlist)
    const validatedFiles: ValidatedFile[] = validateUploadedFiles(files);

    // 3. Stage attachments to disk
    const stagedMetadata: StoredAttachmentMetadata[] = [];
    const stagedFilePaths: string[] = [];

    try {
      for (const vFile of validatedFiles) {
        const metadata = await this.attachmentStorageService.saveAttachment(vFile);
        stagedMetadata.push(metadata);
        stagedFilePaths.push(metadata.filePath);
      }
    } catch (err) {
      await this.attachmentStorageService.cleanupFiles(stagedFilePaths);
      throw err;
    }

    // 4. Database Transaction: Create announcement, attachments, and batch in-app notifications
    let createdAnnouncement: FullAnnouncement;
    let recipientAccountIds: string[] = [];

    try {
      createdAnnouncement = await this.prisma.$transaction(
        async (tx) => {
          // a. Create announcement record
          const ann = await tx.announcement.create({
            data: {
              title: dto.title.trim(),
              content: dto.content.trim(),
              scope: targetScope,
              status: DbAnnouncementStatus.published,
              neighborhoodId: targetNeighborhoodId,
              authorId: currentUser.id,
            },
          });

          // b. Create attachment records
          if (stagedMetadata.length > 0) {
            await tx.attachment.createMany({
              data: stagedMetadata.map((m) => ({
                announcementId: ann.id,
                fileName: m.fileName,
                originalName: m.originalName,
                mimeType: m.mimeType,
                fileSize: m.fileSize,
                filePath: m.filePath,
              })),
            });
          }

          // c. Identify active recipient accounts in scope (excluding the creator)
          const recipientWhere: Prisma.AccountWhereInput = {
            status: DbAccountStatus.active,
            id: { not: currentUser.id },
          };

          if (targetScope === DbAnnouncementScope.neighborhood && targetNeighborhoodId) {
            recipientWhere.neighborhoodId = targetNeighborhoodId;
          }

          const activeAccounts = await tx.account.findMany({
            where: recipientWhere,
            select: { id: true },
          });

          recipientAccountIds = activeAccounts.map((acc) => acc.id);

          // d. Create durable in-app notifications atomically
          if (recipientAccountIds.length > 0) {
            const scopeLabel =
              targetScope === DbAnnouncementScope.ward ? 'Toàn phường' : 'Khu phố';
            await this.notificationsService.createBatchNotifications(
              tx,
              recipientAccountIds,
              {
                title: `Thông báo mới [${scopeLabel}]: ${ann.title.substring(0, 80)}`,
                content: ann.content.substring(0, 200),
                type: NotificationType.ANNOUNCEMENT,
                referenceId: ann.id,
              },
            );
          }

          // Fetch full entity with relations
          const full = await tx.announcement.findUnique({
            where: { id: ann.id },
            include: {
              neighborhood: true,
              author: true,
              attachments: true,
            },
          });

          return full as FullAnnouncement;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
      );
    } catch (dbError) {
      // Compensate: Delete staged files from disk if database transaction failed
      this.logger.error('Database transaction failed while creating announcement; cleaning up staged files');
      await this.attachmentStorageService.cleanupFiles(stagedFilePaths);
      throw dbError;
    }

    // 5. Trigger best-effort Web Push notification (fire & forget, non-blocking)
    if (recipientAccountIds.length > 0) {
      this.notificationsService
        .sendPushNotifications(recipientAccountIds, {
          title: `Thông báo mới: ${createdAnnouncement.title}`,
          body: createdAnnouncement.content.substring(0, 150),
          referenceId: createdAnnouncement.id,
          url: `/announcements/${createdAnnouncement.id}`,
        })
        .catch(() => {
          // Ignored
        });
    }

    return this.formatAnnouncementDto(createdAnnouncement);
  }

  /**
   * Updates an existing announcement (Author or Officer only).
   */
  async update(
    id: string,
    currentUser: UserDto,
    dto: UpdateAnnouncementDto,
  ): Promise<AnnouncementDto> {
    const existing = await this.prisma.announcement.findUnique({
      where: { id },
      include: { neighborhood: true, author: true, attachments: true },
    });

    if (!existing) {
      throw new AppException(
        'Không tìm thấy thông báo.',
        HttpStatus.NOT_FOUND,
        ErrorCode.ANNOUNCEMENT_NOT_FOUND,
      );
    }

    if (existing.status === DbAnnouncementStatus.removed) {
      throw new AppException(
        'Không thể chỉnh sửa thông báo đã bị gỡ bỏ.',
        HttpStatus.BAD_REQUEST,
        ErrorCode.ANNOUNCEMENT_REMOVED,
      );
    }

    // Authorization
    if (currentUser.role === UserRole.RESIDENT) {
      throw new AppException(
        'Cư dân không có quyền chỉnh sửa thông báo.',
        HttpStatus.FORBIDDEN,
        ErrorCode.FORBIDDEN,
      );
    }

    if (currentUser.role === UserRole.LEADER) {
      if (existing.authorId !== currentUser.id) {
        throw new AppException(
          'Trưởng khu phố chỉ có thể chỉnh sửa thông báo do chính mình tạo.',
          HttpStatus.FORBIDDEN,
          ErrorCode.FORBIDDEN,
        );
      }
      if (existing.neighborhoodId !== currentUser.neighborhoodId) {
        throw new AppException(
          'Bạn không có quyền chỉnh sửa thông báo thuộc khu phố khác.',
          HttpStatus.FORBIDDEN,
          ErrorCode.FORBIDDEN,
        );
      }
    }

    const data: Prisma.AnnouncementUpdateInput = {};
    if (dto.title && dto.title.trim()) {
      data.title = dto.title.trim();
    }
    if (dto.content && dto.content.trim()) {
      data.content = dto.content.trim();
    }

    const updated = await this.prisma.announcement.update({
      where: { id },
      data,
      include: {
        neighborhood: true,
        author: true,
        attachments: true,
        _count: { select: { comments: true } },
      },
    });

    return this.formatAnnouncementDto(updated as FullAnnouncement);
  }

  /**
   * Soft-removes an announcement (Creator or Officer only).
   * Leaves ordinary feeds while keeping history and comment records intact.
   */
  async remove(id: string, currentUser: UserDto): Promise<{ success: boolean; message: string }> {
    const existing = await this.prisma.announcement.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new AppException(
        'Không tìm thấy thông báo.',
        HttpStatus.NOT_FOUND,
        ErrorCode.ANNOUNCEMENT_NOT_FOUND,
      );
    }

    if (currentUser.role === UserRole.RESIDENT) {
      throw new AppException(
        'Cư dân không có quyền gỡ bỏ thông báo.',
        HttpStatus.FORBIDDEN,
        ErrorCode.FORBIDDEN,
      );
    }

    if (currentUser.role === UserRole.LEADER) {
      if (existing.authorId !== currentUser.id) {
        throw new AppException(
          'Trưởng khu phố chỉ có thể gỡ bỏ thông báo do chính mình tạo.',
          HttpStatus.FORBIDDEN,
          ErrorCode.FORBIDDEN,
        );
      }
      if (existing.neighborhoodId !== currentUser.neighborhoodId) {
        throw new AppException(
          'Bạn không có quyền gỡ thông báo thuộc khu phố khác.',
          HttpStatus.FORBIDDEN,
          ErrorCode.FORBIDDEN,
        );
      }
    }

    await this.prisma.announcement.update({
      where: { id },
      data: { status: DbAnnouncementStatus.removed },
    });

    return {
      success: true,
      message: 'Thông báo đã được gỡ bỏ khỏi bảng tin công khai.',
    };
  }

  /**
   * Protected download: checks announcement visibility, attachment ownership, and path containment.
   */
  async downloadAttachment(
    announcementId: string,
    attachmentId: string,
    currentUser: UserDto,
  ): Promise<{
    filePath: string;
    originalName: string;
    mimeType: string;
    fileSize: number;
  }> {
    const announcement = await this.prisma.announcement.findUnique({
      where: { id: announcementId },
    });

    if (!announcement) {
      throw new AppException(
        'Không tìm thấy thông báo.',
        HttpStatus.NOT_FOUND,
        ErrorCode.ANNOUNCEMENT_NOT_FOUND,
      );
    }

    if (!this.canUserViewAnnouncement(announcement, currentUser)) {
      throw new AppException(
        'Bạn không có quyền truy cập tệp đính kèm này.',
        HttpStatus.FORBIDDEN,
        ErrorCode.FORBIDDEN,
      );
    }

    const attachment = await this.prisma.attachment.findFirst({
      where: {
        id: attachmentId,
        announcementId,
      },
    });

    if (!attachment) {
      throw new AppException(
        'Không tìm thấy tệp đính kèm.',
        HttpStatus.NOT_FOUND,
        ErrorCode.ATTACHMENT_NOT_FOUND,
      );
    }

    const resolvedPath = await this.attachmentStorageService.resolveAttachmentPath(
      attachment.fileName,
    );

    return {
      filePath: resolvedPath,
      originalName: attachment.originalName,
      mimeType: attachment.mimeType,
      fileSize: attachment.fileSize,
    };
  }

  /**
   * Creates a comment on a visible, non-removed announcement.
   * Notifies the announcement author if they are not the commenter.
   */
  async createComment(
    announcementId: string,
    currentUser: UserDto,
    dto: CreateCommentDto,
  ): Promise<CommentDto> {
    const content = dto.content.trim();
    if (!content) {
      throw new AppException(
        'Nội dung bình luận không được để trống.',
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    const announcement = await this.prisma.announcement.findUnique({
      where: { id: announcementId },
    });

    if (!announcement) {
      throw new AppException(
        'Không tìm thấy thông báo để bình luận.',
        HttpStatus.NOT_FOUND,
        ErrorCode.ANNOUNCEMENT_NOT_FOUND,
      );
    }

    if (!this.canUserViewAnnouncement(announcement, currentUser)) {
      throw new AppException(
        'Bạn không có quyền bình luận trên thông báo này.',
        HttpStatus.FORBIDDEN,
        ErrorCode.FORBIDDEN,
      );
    }

    if (announcement.status === DbAnnouncementStatus.removed) {
      throw new AppException(
        'Không thể bình luận trên thông báo đã bị gỡ bỏ.',
        HttpStatus.BAD_REQUEST,
        ErrorCode.ANNOUNCEMENT_REMOVED,
      );
    }

    const shouldNotifyAuthor = announcement.authorId !== currentUser.id;

    const comment = await this.prisma.$transaction(
      async (tx) => {
        const createdComment = await tx.comment.create({
          data: {
            announcementId,
            authorId: currentUser.id,
            content,
            isRemoved: false,
          },
          include: {
            author: true,
          },
        });

        if (shouldNotifyAuthor) {
          await this.notificationsService.createNotification(tx, {
            accountId: announcement.authorId,
            title: `Bình luận mới từ ${currentUser.fullName}`,
            content: `${currentUser.fullName} đã bình luận trên thông báo "${announcement.title.substring(0, 50)}": ${content.substring(0, 100)}`,
            type: NotificationType.COMMENT,
            referenceId: announcement.id,
          });
        }

        return createdComment;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );

    // Trigger Web Push only after commit (best-effort, non-blocking)
    if (shouldNotifyAuthor) {
      this.notificationsService
        .sendPushNotifications([announcement.authorId], {
          title: `Bình luận mới: ${announcement.title}`,
          body: `${currentUser.fullName}: ${content.substring(0, 100)}`,
          referenceId: announcement.id,
          url: `/announcements/${announcement.id}`,
        })
        .catch(() => {
          // Ignored
        });
    }

    return {
      id: comment.id,
      announcementId: comment.announcementId,
      authorId: comment.authorId,
      author: {
        id: comment.author.id,
        fullName: comment.author.fullName,
        role: comment.author.role as unknown as UserRole,
        neighborhoodId: comment.author.neighborhoodId,
      },
      content: comment.content,
      isRemoved: comment.isRemoved,
      removedReason: comment.removedReason,
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
    };
  }

  /**
   * Moderates a comment (Leader within own neighborhood, Officer ward-wide).
   */
  async moderateComment(
    announcementId: string,
    commentId: string,
    currentUser: UserDto,
    dto: ModerateCommentDto,
  ): Promise<CommentDto> {
    const announcement = await this.prisma.announcement.findUnique({
      where: { id: announcementId },
    });

    if (!announcement) {
      throw new AppException(
        'Không tìm thấy thông báo.',
        HttpStatus.NOT_FOUND,
        ErrorCode.ANNOUNCEMENT_NOT_FOUND,
      );
    }

    const comment = await this.prisma.comment.findFirst({
      where: { id: commentId, announcementId },
      include: { author: true },
    });

    if (!comment) {
      throw new AppException(
        'Không tìm thấy bình luận.',
        HttpStatus.NOT_FOUND,
        ErrorCode.COMMENT_NOT_FOUND,
      );
    }

    // Role and neighborhood moderation authorization
    if (currentUser.role === UserRole.RESIDENT) {
      throw new AppException(
        'Cư dân không có quyền kiểm duyệt bình luận.',
        HttpStatus.FORBIDDEN,
        ErrorCode.FORBIDDEN,
      );
    }

    if (currentUser.role === UserRole.LEADER) {
      if (announcement.neighborhoodId !== currentUser.neighborhoodId) {
        throw new AppException(
          'Trưởng khu phố chỉ có thể kiểm duyệt bình luận trong khu phố của mình.',
          HttpStatus.FORBIDDEN,
          ErrorCode.FORBIDDEN,
        );
      }
    }

    if (!dto.isRemoved) {
      throw new AppException(
        'Bình luận đã ẩn không thể được mở lại.',
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    if (comment.isRemoved) {
      throw new AppException(
        'Bình luận này đã được kiểm duyệt trước đó.',
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    const updated = await this.prisma.comment.update({
      where: { id: commentId },
      data: {
        isRemoved: true,
        removedReason: dto.removedReason?.trim() || 'Nội dung không phù hợp',
        removedBy: currentUser.id,
      },
      include: { author: true },
    });

    return {
      id: updated.id,
      announcementId: updated.announcementId,
      authorId: updated.authorId,
      author: {
        id: updated.author.id,
        fullName: updated.author.fullName,
        role: updated.author.role as unknown as UserRole,
        neighborhoodId: updated.author.neighborhoodId,
      },
      content: updated.content,
      isRemoved: updated.isRemoved,
      removedReason: updated.removedReason,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }
}
