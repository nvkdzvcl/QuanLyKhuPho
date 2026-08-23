import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { ErrorCode } from '@quanlykhupho/shared-types';
import { AppException } from '../core/exceptions/app.exception';
import { ValidatedFile } from './file-signature.validator';

export interface StoredAttachmentMetadata {
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  filePath: string;
}

/**
 * Verifies that targetPath is strictly inside parentDir using path.relative,
 * preventing prefix attacks (e.g. /uploads vs /uploads_fake) and path traversal.
 */
export function isPathContained(targetPath: string, parentDir: string): boolean {
  const relative = path.relative(path.resolve(parentDir), path.resolve(targetPath));
  return Boolean(relative && !relative.startsWith('..') && !path.isAbsolute(relative));
}

@Injectable()
export class AttachmentStorageService implements OnModuleInit {
  private readonly logger = new Logger(AttachmentStorageService.name);
  private readonly uploadDir: string;

  constructor(private readonly configService: ConfigService) {
    const configuredDir = this.configService.get<string>('UPLOAD_DIR');
    this.uploadDir = configuredDir
      ? path.resolve(configuredDir)
      : path.resolve(process.cwd(), 'uploads');
  }

  async onModuleInit() {
    try {
      await fs.promises.mkdir(this.uploadDir, { recursive: true });
      this.logger.log(`Attachment storage initialized at: [REDACTED_PATH]`);
    } catch {
      this.logger.error('Failed to create attachment upload directory');
    }
  }

  /**
   * Saves a validated file to disk using a randomized UUID server filename
   * outside the public web root.
   */
  async saveAttachment(file: ValidatedFile): Promise<StoredAttachmentMetadata> {
    const serverFileName = `${randomUUID()}${file.extension}`;
    const destinationPath = path.resolve(this.uploadDir, serverFileName);

    // Path containment check (defense-in-depth against path traversal)
    if (!isPathContained(destinationPath, this.uploadDir)) {
      throw new AppException(
        'Đường dẫn lưu trữ không an toàn.',
        400,
        ErrorCode.INVALID_ATTACHMENT,
      );
    }

    try {
      await fs.promises.writeFile(destinationPath, file.buffer);
    } catch {
      throw new AppException(
        'Không thể lưu tệp đính kèm lên máy chủ.',
        500,
        ErrorCode.INTERNAL_ERROR,
      );
    }

    return {
      fileName: serverFileName,
      originalName: file.sanitizedName,
      mimeType: file.mimeType,
      fileSize: file.size,
      filePath: destinationPath,
    };
  }

  /**
   * Compensating rollback: deletes staged files from disk when database operations fail.
   */
  async cleanupFiles(filePaths: string[]): Promise<void> {
    for (const filePath of filePaths) {
      try {
        if (filePath && isPathContained(filePath, this.uploadDir)) {
          await fs.promises.unlink(filePath);
        }
      } catch {
        // Silently ignore if already removed
      }
    }
  }

  /**
   * Safely resolves and validates containment for an attachment download.
   */
  async resolveAttachmentPath(fileName: string): Promise<string> {
    // Filename must not contain path separators
    if (!fileName || fileName.includes('/') || fileName.includes('\\') || fileName.includes('..')) {
      throw new AppException(
        'Tên tệp không hợp lệ.',
        400,
        ErrorCode.INVALID_ATTACHMENT,
      );
    }

    const resolvedPath = path.resolve(this.uploadDir, fileName);
    if (!isPathContained(resolvedPath, this.uploadDir)) {
      throw new AppException(
        'Đường dẫn tệp không an toàn.',
        403,
        ErrorCode.FORBIDDEN,
      );
    }

    try {
      await fs.promises.access(resolvedPath, fs.constants.R_OK);
      return resolvedPath;
    } catch {
      throw new AppException(
        'Tệp đính kèm không tồn tại trên hệ thống lưu trữ.',
        404,
        ErrorCode.ATTACHMENT_NOT_FOUND,
      );
    }
  }
}
