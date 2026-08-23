import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import {
  Account,
  Neighborhood,
  Petition,
  PetitionEvidence,
  PetitionHistory,
  Prisma,
  Role,
  AccountStatus as DbAccountStatus,
  PetitionCategory as DbPetitionCategory,
  PetitionStatus as DbPetitionStatus,
  NotificationType as DbNotificationType,
} from '@prisma/client';
import {
  CancelPetitionDto,
  CreatePetitionDto,
  ErrorCode,
  PetitionCategory,
  PetitionDetailDto,
  PetitionDto,
  PetitionFilterQueryDto,
  PetitionHistoryDto,
  PetitionListResponseDto,
  PetitionStatus,
  UpdatePetitionStatusDto,
  UserDto,
  UserRole,
} from '@quanlykhupho/shared-types';
import { AppException } from '../core/exceptions/app.exception';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CryptoService } from '../security/crypto.service';
import { maskPhoneNumber } from '../security/phone-utils';
import {
  PetitionEvidenceStorageService,
  StoredEvidenceMetadata,
} from './petition-evidence-storage.service';
import {
  validateUploadedEvidenceFiles,
  ValidatedEvidenceFile,
} from './evidence-file.validator';

type FullPetition = Petition & {
  neighborhood: Neighborhood | null;
  author: Account;
  evidence: PetitionEvidence[];
  histories?: (PetitionHistory & { changedBy: Account })[];
};

@Injectable()
export class PetitionsService {
  private readonly logger = new Logger(PetitionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly evidenceStorageService: PetitionEvidenceStorageService,
    private readonly cryptoService: CryptoService,
  ) {}

  /**
   * Helper to format a database Petition into a safe PetitionDto.
   * Author phone number is decrypted and masked (091***5678) for safe display.
   */
  private formatPetitionDto(petition: FullPetition): PetitionDto {
    let authorMaskedPhone = '***';
    try {
      if (petition.author.phoneEncrypted) {
        const decrypted = this.cryptoService.decrypt(petition.author.phoneEncrypted);
        authorMaskedPhone = maskPhoneNumber(decrypted);
      }
    } catch {
      authorMaskedPhone = '***';
    }

    const latestHistory =
      petition.histories && petition.histories.length > 0
        ? this.formatHistoryDto(petition.histories[petition.histories.length - 1]!)
        : null;

    return {
      id: petition.id,
      title: petition.title,
      description: petition.description,
      category: petition.category as unknown as PetitionCategory,
      status: petition.status as unknown as PetitionStatus,
      neighborhoodId: petition.neighborhoodId,
      neighborhood: petition.neighborhood
        ? {
            id: petition.neighborhood.id,
            code: petition.neighborhood.code,
            name: petition.neighborhood.name,
            ward: petition.neighborhood.ward,
            district: petition.neighborhood.district,
            city: petition.neighborhood.city,
            description: petition.neighborhood.description,
            createdAt: petition.neighborhood.createdAt.toISOString(),
            updatedAt: petition.neighborhood.updatedAt.toISOString(),
          }
        : null,
      authorId: petition.authorId,
      author: {
        id: petition.author.id,
        fullName: petition.author.fullName,
        role: petition.author.role as unknown as UserRole,
        maskedPhone: authorMaskedPhone,
        address: petition.author.address,
      },
      evidence: (petition.evidence || []).map((ev) => ({
        id: ev.id,
        petitionId: ev.petitionId,
        fileName: ev.fileName,
        originalName: ev.originalName,
        mimeType: ev.mimeType,
        fileSize: ev.fileSize,
        createdAt: ev.createdAt.toISOString(),
      })),
      latestHistory,
      responseNote: petition.responseNote,
      createdAt: petition.createdAt.toISOString(),
      updatedAt: petition.updatedAt.toISOString(),
    };
  }

  /**
   * Formats a database PetitionHistory row into PetitionHistoryDto.
   */
  private formatHistoryDto(
    history: PetitionHistory & { changedBy: Account },
  ): PetitionHistoryDto {
    let changedByMaskedPhone: string | undefined;
    try {
      if (history.changedBy?.phoneEncrypted) {
        const decrypted = this.cryptoService.decrypt(history.changedBy.phoneEncrypted);
        changedByMaskedPhone = maskPhoneNumber(decrypted);
      }
    } catch {
      changedByMaskedPhone = undefined;
    }

    return {
      id: history.id,
      petitionId: history.petitionId,
      fromStatus: (history.fromStatus as unknown as PetitionStatus) || null,
      toStatus: history.toStatus as unknown as PetitionStatus,
      changedById: history.changedById,
      changedBy: history.changedBy
        ? {
            id: history.changedBy.id,
            fullName: history.changedBy.fullName,
            role: history.changedBy.role as unknown as UserRole,
            maskedPhone: changedByMaskedPhone,
          }
        : null,
      note: history.note,
      createdAt: history.createdAt.toISOString(),
    };
  }

  /**
   * Resident-only multipart create with required category/title/description
   * and optional validated image evidence (JPEG, PNG, WebP, max 5, max 10MB each).
   * Appends initial history row and notifies active leaders in the neighborhood.
   */
  async create(
    currentUser: UserDto,
    dto: CreatePetitionDto,
    files?: Express.Multer.File[],
  ): Promise<PetitionDto> {
    if (currentUser.role !== UserRole.RESIDENT) {
      throw new AppException(
        'Chỉ cư dân mới có quyền gửi kiến nghị & phản ánh.',
        HttpStatus.FORBIDDEN,
        ErrorCode.FORBIDDEN,
      );
    }

    if (!currentUser.neighborhoodId) {
      throw new AppException(
        'Tài khoản cư dân chưa được liên kết với khu phố nào.',
        HttpStatus.BAD_REQUEST,
        ErrorCode.NEIGHBORHOOD_NOT_FOUND,
      );
    }

    if (!dto.title || dto.title.trim().length === 0) {
      throw new AppException(
        'Tiêu đề kiến nghị không được để trống.',
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    if (!dto.description || dto.description.trim().length === 0) {
      throw new AppException(
        'Nội dung kiến nghị không được để trống.',
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    // 1. Validate uploaded evidence images
    const validatedFiles: ValidatedEvidenceFile[] = validateUploadedEvidenceFiles(files);

    // 2. Stage evidence images to disk
    const stagedMetadata: StoredEvidenceMetadata[] = [];
    const stagedFilePaths: string[] = [];

    try {
      for (const vFile of validatedFiles) {
        const metadata = await this.evidenceStorageService.saveEvidence(vFile);
        stagedMetadata.push(metadata);
        stagedFilePaths.push(metadata.filePath);
      }
    } catch (err) {
      await this.evidenceStorageService.cleanupFiles(stagedFilePaths);
      throw err;
    }

    // 3. Database Transaction: Create petition, evidence rows, initial status history, and leader notifications
    let createdPetition: FullPetition;
    let activeLeaderIds: string[] = [];

    try {
      createdPetition = await this.prisma.$transaction(
        async (tx) => {
          // a. Create petition record (starts in reviewing status)
          const petition = await tx.petition.create({
            data: {
              title: dto.title.trim(),
              description: dto.description.trim(),
              category: dto.category as unknown as DbPetitionCategory,
              status: DbPetitionStatus.reviewing,
              neighborhoodId: currentUser.neighborhoodId!,
              authorId: currentUser.id,
            },
          });

          // b. Create evidence records
          if (stagedMetadata.length > 0) {
            await tx.petitionEvidence.createMany({
              data: stagedMetadata.map((m) => ({
                petitionId: petition.id,
                fileName: m.fileName,
                originalName: m.originalName,
                mimeType: m.mimeType,
                fileSize: m.fileSize,
                filePath: m.filePath,
              })),
            });
          }

          // c. Append initial status history (fromStatus: null, toStatus: reviewing)
          await tx.petitionHistory.create({
            data: {
              petitionId: petition.id,
              fromStatus: null,
              toStatus: DbPetitionStatus.reviewing,
              changedById: currentUser.id,
              note: 'Tạo kiến nghị mới',
            },
          });

          // d. Find active leaders in resident's neighborhood
          const activeLeaders = await tx.account.findMany({
            where: {
              role: Role.leader,
              status: DbAccountStatus.active,
              neighborhoodId: currentUser.neighborhoodId,
            },
            select: { id: true },
          });

          activeLeaderIds = activeLeaders.map((l) => l.id);

          // e. Create durable in-app notifications for active leaders
          if (activeLeaderIds.length > 0) {
            const notifRecords = activeLeaderIds.map((leaderId) => ({
              accountId: leaderId,
              title: `Kiến nghị mới trong khu phố: ${petition.title.substring(0, 80)}`,
              content: `Cư dân ${currentUser.fullName} vừa gửi một kiến nghị mới cần tiếp nhận xử lý.`,
              type: DbNotificationType.petition,
              referenceId: petition.id,
            }));

            await tx.notification.createMany({
              data: notifRecords,
            });
          }

          // Fetch full petition with relations
          const full = await tx.petition.findUnique({
            where: { id: petition.id },
            include: {
              neighborhood: true,
              author: true,
              evidence: true,
              histories: {
                include: { changedBy: true },
                orderBy: { createdAt: 'asc' },
              },
            },
          });

          return full as FullPetition;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
      );
    } catch (dbError) {
      // Compensate: Delete staged files from disk if database transaction failed
      this.logger.error(
        'Database transaction failed while creating petition; cleaning up staged evidence files',
      );
      await this.evidenceStorageService.cleanupFiles(stagedFilePaths);
      throw dbError;
    }

    // 4. Trigger best-effort Web Push notification to leaders (non-blocking)
    if (activeLeaderIds.length > 0) {
      this.notificationsService
        .sendPushNotifications(activeLeaderIds, {
          title: `Kiến nghị mới: ${createdPetition.title}`,
          body: `Cư dân ${currentUser.fullName} gửi kiến nghị: ${createdPetition.description.substring(0, 120)}`,
          referenceId: createdPetition.id,
          url: `/petitions/${createdPetition.id}`,
        })
        .catch(() => {
          // Ignored
        });
    }

    return this.formatPetitionDto(createdPetition);
  }

  /**
   * Role-scoped list query with filtering:
   * - Resident sees only own petitions.
   * - Leader sees only assigned neighborhood petitions.
   * - Officer sees ward-wide or filters by neighborhood.
   */
  async findAll(
    currentUser: UserDto,
    query: PetitionFilterQueryDto,
  ): Promise<PetitionListResponseDto> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const andConditions: Prisma.PetitionWhereInput[] = [];

    // Role-scoping enforcement
    if (currentUser.role === UserRole.RESIDENT) {
      // Resident strictly sees only their own petitions
      andConditions.push({ authorId: currentUser.id });
    } else if (currentUser.role === UserRole.LEADER) {
      if (!currentUser.neighborhoodId) {
        throw new AppException(
          'Trưởng khu phố chưa được phân công khu phố quản lý.',
          HttpStatus.FORBIDDEN,
          ErrorCode.FORBIDDEN,
        );
      }
      // Leader strictly sees only their assigned neighborhood
      andConditions.push({ neighborhoodId: currentUser.neighborhoodId });
    } else if (currentUser.role === UserRole.OFFICER) {
      // Officer sees ward-wide by default, can filter by neighborhoodId
      if (query.neighborhoodId) {
        andConditions.push({ neighborhoodId: query.neighborhoodId });
      }
    }

    // Status filter
    if (query.status) {
      andConditions.push({
        status: query.status as unknown as DbPetitionStatus,
      });
    }

    // Category filter
    if (query.category) {
      andConditions.push({
        category: query.category as unknown as DbPetitionCategory,
      });
    }

    // Date range filter
    if (query.startDate && query.endDate) {
      const start = new Date(query.startDate);
      const end = new Date(query.endDate);
      if (start > end) {
        throw new AppException(
          'Ngày bắt đầu không được lớn hơn ngày kết thúc.',
          HttpStatus.BAD_REQUEST,
          ErrorCode.VALIDATION_ERROR,
        );
      }
    }

    if (query.startDate || query.endDate) {
      const createdAtFilter: Prisma.DateTimeFilter = {};
      if (query.startDate) {
        createdAtFilter.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        const end = new Date(query.endDate);
        // Include full end date if only date string
        if (query.endDate.length === 10) {
          end.setHours(23, 59, 59, 999);
        }
        createdAtFilter.lte = end;
      }
      andConditions.push({ createdAt: createdAtFilter });
    }

    // Search query on title and description
    if (query.search && query.search.trim()) {
      const search = query.search.trim();
      andConditions.push({
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    const where: Prisma.PetitionWhereInput =
      andConditions.length > 0 ? { AND: andConditions } : {};

    const [items, total] = await Promise.all([
      this.prisma.petition.findMany({
        where,
        include: {
          neighborhood: true,
          author: true,
          evidence: true,
          histories: {
            include: { changedBy: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.petition.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      items: items.map((item) => this.formatPetitionDto(item as FullPetition)),
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Detail view with full chronological status history and evidence.
   * Role scope is enforced server-side.
   */
  async findOne(currentUser: UserDto, id: string): Promise<PetitionDetailDto> {
    const petition = await this.prisma.petition.findUnique({
      where: { id },
      include: {
        neighborhood: true,
        author: true,
        evidence: true,
        histories: {
          include: { changedBy: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!petition) {
      throw new AppException(
        'Không tìm thấy kiến nghị.',
        HttpStatus.NOT_FOUND,
        ErrorCode.PETITION_NOT_FOUND,
      );
    }

    // Authorization & scoping check
    if (currentUser.role === UserRole.RESIDENT) {
      if (petition.authorId !== currentUser.id) {
        throw new AppException(
          'Không tìm thấy kiến nghị.',
          HttpStatus.NOT_FOUND,
          ErrorCode.PETITION_NOT_FOUND,
        );
      }
    } else if (currentUser.role === UserRole.LEADER) {
      if (petition.neighborhoodId !== currentUser.neighborhoodId) {
        throw new AppException(
          'Không tìm thấy kiến nghị trong phạm vi quản lý của khu phố.',
          HttpStatus.NOT_FOUND,
          ErrorCode.PETITION_NOT_FOUND,
        );
      }
    }

    const baseDto = this.formatPetitionDto(petition as FullPetition);
    const historyDtos: PetitionHistoryDto[] = (petition.histories || []).map(
      (h) => this.formatHistoryDto(h),
    );

    return {
      ...baseDto,
      history: historyDtos,
    };
  }

  /**
   * Protected evidence image download:
   * Verifies petition scoping, evidence ownership, and safe path containment.
   */
  async getEvidenceStream(
    currentUser: UserDto,
    petitionId: string,
    evidenceId: string,
  ): Promise<{
    filePath: string;
    originalName: string;
    mimeType: string;
    fileSize: number;
  }> {
    // Check petition visibility first
    await this.findOne(currentUser, petitionId);

    const evidence = await this.prisma.petitionEvidence.findFirst({
      where: {
        id: evidenceId,
        petitionId,
      },
    });

    if (!evidence) {
      throw new AppException(
        'Không tìm thấy hình ảnh minh chứng.',
        HttpStatus.NOT_FOUND,
        ErrorCode.PETITION_EVIDENCE_NOT_FOUND,
      );
    }

    const resolvedPath = await this.evidenceStorageService.resolveEvidencePath(
      evidence.fileName,
    );

    return {
      filePath: resolvedPath,
      originalName: evidence.originalName,
      mimeType: evidence.mimeType,
      fileSize: evidence.fileSize,
    };
  }

  /**
   * Leader / Officer status transition:
   * State Machine:
   * - reviewing -> processing
   * - processing -> resolved | rejected (rejection requires nonblank responseNote/reason)
   * Terminal states (resolved, rejected, cancelled) cannot transition.
   * Concurrency-safe: stale transitions cannot create duplicate/invalid history.
   * Appends immutable history and creates durable author notification in the same transaction.
   */
  async updateStatus(
    currentUser: UserDto,
    id: string,
    dto: UpdatePetitionStatusDto,
  ): Promise<PetitionDetailDto> {
    if (
      currentUser.role !== UserRole.LEADER &&
      currentUser.role !== UserRole.OFFICER
    ) {
      throw new AppException(
        'Chỉ Trưởng khu phố hoặc Cán bộ phường mới có quyền xử lý kiến nghị.',
        HttpStatus.FORBIDDEN,
        ErrorCode.FORBIDDEN,
      );
    }

    const existing = await this.prisma.petition.findUnique({
      where: { id },
      include: { neighborhood: true, author: true },
    });

    if (!existing) {
      throw new AppException(
        'Không tìm thấy kiến nghị.',
        HttpStatus.NOT_FOUND,
        ErrorCode.PETITION_NOT_FOUND,
      );
    }

    // Leader neighborhood check
    if (currentUser.role === UserRole.LEADER) {
      if (existing.neighborhoodId !== currentUser.neighborhoodId) {
        throw new AppException(
          'Bạn không có quyền xử lý kiến nghị thuộc khu phố khác.',
          HttpStatus.FORBIDDEN,
          ErrorCode.FORBIDDEN,
        );
      }
    }

    const currentStatus = existing.status as unknown as PetitionStatus;
    const targetStatus = dto.status;

    // Validate legal state transitions
    const isLegalTransition =
      (currentStatus === PetitionStatus.REVIEWING &&
        targetStatus === PetitionStatus.PROCESSING) ||
      (currentStatus === PetitionStatus.PROCESSING &&
        (targetStatus === PetitionStatus.RESOLVED ||
          targetStatus === PetitionStatus.REJECTED));

    if (!isLegalTransition) {
      throw new AppException(
        `Không thể chuyển trạng thái kiến nghị từ "${currentStatus}" sang "${targetStatus}".`,
        HttpStatus.BAD_REQUEST,
        ErrorCode.INVALID_PETITION_TRANSITION,
      );
    }

    // Rejection requires a nonblank responseNote
    if (targetStatus === PetitionStatus.REJECTED) {
      if (!dto.responseNote || dto.responseNote.trim().length === 0) {
        throw new AppException(
          'Vui lòng nhập lý do / phản hồi từ chối kiến nghị.',
          HttpStatus.BAD_REQUEST,
          ErrorCode.PETITION_REJECTION_REASON_REQUIRED,
        );
      }
    }

    const cleanNote = dto.responseNote?.trim() || null;
    let defaultHistoryNote = cleanNote;
    if (!defaultHistoryNote) {
      if (targetStatus === PetitionStatus.PROCESSING) {
        defaultHistoryNote = 'Tiếp nhận xử lý kiến nghị';
      } else if (targetStatus === PetitionStatus.RESOLVED) {
        defaultHistoryNote = 'Đã giải quyết kiến nghị thành công';
      }
    }

    // Transactional state update + append history + durable author notification
    await this.prisma.$transaction(
      async (tx) => {
        // Atomic status mutation with optimistic concurrency check
        const updateResult = await tx.petition.updateMany({
          where: {
            id,
            status: existing.status,
            ...(currentUser.role === UserRole.LEADER && currentUser.neighborhoodId
              ? { neighborhoodId: currentUser.neighborhoodId }
              : {}),
          },
          data: {
            status: targetStatus as unknown as DbPetitionStatus,
            responseNote: cleanNote,
          },
        });

        if (updateResult.count === 0) {
          throw new AppException(
            'Trạng thái kiến nghị đã thay đổi trên hệ thống hoặc thao tác không hợp lệ.',
            HttpStatus.CONFLICT,
            ErrorCode.INVALID_STATUS_TRANSITION,
          );
        }

        // Append immutable history row
        await tx.petitionHistory.create({
          data: {
            petitionId: id,
            fromStatus: existing.status,
            toStatus: targetStatus as unknown as DbPetitionStatus,
            changedById: currentUser.id,
            note: defaultHistoryNote,
          },
        });

        // Create durable in-app notification for the author
        let statusTitle = 'Đang xử lý';
        if (targetStatus === PetitionStatus.RESOLVED) statusTitle = 'Đã giải quyết';
        if (targetStatus === PetitionStatus.REJECTED) statusTitle = 'Bị từ chối';

        await tx.notification.create({
          data: {
            accountId: existing.authorId,
            title: `Cập nhật trạng thái kiến nghị: ${statusTitle}`,
            content: `Kiến nghị "${existing.title}" của bạn đã chuyển sang trạng thái "${statusTitle}".${cleanNote ? ` Phản hồi: "${cleanNote}"` : ''}`,
            type: DbNotificationType.petition,
            referenceId: existing.id,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );

    // Trigger best-effort Web Push notification to author (post-commit)
    let statusText = 'Đang xử lý';
    if (targetStatus === PetitionStatus.RESOLVED) statusText = 'Đã giải quyết';
    if (targetStatus === PetitionStatus.REJECTED) statusText = 'Bị từ chối';

    this.notificationsService
      .sendPushNotifications([existing.authorId], {
        title: `Kiến nghị: ${statusText}`,
        body: `Kiến nghị "${existing.title}" đã được cập nhật: ${statusText}.${cleanNote ? ` (${cleanNote})` : ''}`,
        referenceId: existing.id,
        url: `/petitions/${existing.id}`,
      })
      .catch(() => {
        // Ignored
      });

    return this.findOne(currentUser, id);
  }

  /**
   * Resident author cancels own petition:
   * Allowed ONLY when status is reviewing.
   * Concurrency-safe atomic transaction.
   */
  async cancel(
    currentUser: UserDto,
    id: string,
    dto?: CancelPetitionDto,
  ): Promise<PetitionDetailDto> {
    if (currentUser.role !== UserRole.RESIDENT) {
      throw new AppException(
        'Chỉ tác giả cư dân mới có quyền hủy kiến nghị của mình.',
        HttpStatus.FORBIDDEN,
        ErrorCode.FORBIDDEN,
      );
    }

    const existing = await this.prisma.petition.findUnique({
      where: { id },
    });

    if (!existing || existing.authorId !== currentUser.id) {
      throw new AppException(
        'Không tìm thấy kiến nghị.',
        HttpStatus.NOT_FOUND,
        ErrorCode.PETITION_NOT_FOUND,
      );
    }

    const currentStatus = existing.status as unknown as PetitionStatus;
    if (currentStatus !== PetitionStatus.REVIEWING) {
      throw new AppException(
        `Không thể hủy kiến nghị đang ở trạng thái "${currentStatus}". Chỉ có thể hủy kiến nghị khi đang chờ tiếp nhận (reviewing).`,
        HttpStatus.BAD_REQUEST,
        ErrorCode.PETITION_CANNOT_BE_CANCELLED,
      );
    }

    const cancelReason = dto?.reason?.trim() || 'Cư dân đã hủy kiến nghị';

    await this.prisma.$transaction(
      async (tx) => {
        const updateResult = await tx.petition.updateMany({
          where: {
            id,
            authorId: currentUser.id,
            status: DbPetitionStatus.reviewing,
          },
          data: {
            status: DbPetitionStatus.cancelled,
            responseNote: cancelReason,
          },
        });

        if (updateResult.count === 0) {
          throw new AppException(
            'Không thể hủy kiến nghị vì trạng thái đã thay đổi trên hệ thống.',
            HttpStatus.CONFLICT,
            ErrorCode.PETITION_CANNOT_BE_CANCELLED,
          );
        }

        // Append immutable history row
        await tx.petitionHistory.create({
          data: {
            petitionId: id,
            fromStatus: DbPetitionStatus.reviewing,
            toStatus: DbPetitionStatus.cancelled,
            changedById: currentUser.id,
            note: cancelReason,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );

    return this.findOne(currentUser, id);
  }
}
