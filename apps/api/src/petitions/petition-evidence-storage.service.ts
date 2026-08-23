import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { ErrorCode } from '@quanlykhupho/shared-types';
import { AppException } from '../core/exceptions/app.exception';
import { ValidatedEvidenceFile } from './evidence-file.validator';
import { isPathContained } from '../announcements/attachment-storage.service';

export interface StoredEvidenceMetadata {
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  filePath: string;
}

@Injectable()
export class PetitionEvidenceStorageService implements OnModuleInit {
  private readonly logger = new Logger(PetitionEvidenceStorageService.name);
  private readonly uploadDir: string;

  constructor(private readonly configService: ConfigService) {
    const configuredDir = this.configService.get<string>('UPLOAD_DIR');
    const baseUploadDir = configuredDir
      ? path.resolve(configuredDir)
      : path.resolve(process.cwd(), 'uploads');
    this.uploadDir = path.resolve(baseUploadDir, 'petitions');
  }

  async onModuleInit() {
    try {
      await fs.promises.mkdir(this.uploadDir, { recursive: true });
      this.logger.log(`Petition evidence storage initialized at: [REDACTED_PATH]`);
    } catch {
      this.logger.error('Failed to create petition evidence upload directory');
    }
  }

  /**
   * Saves a validated evidence image to disk using a randomized UUID server filename
   * outside the public web root.
   */
  async saveEvidence(
    file: ValidatedEvidenceFile,
  ): Promise<StoredEvidenceMetadata> {
    const serverFileName = `${randomUUID()}${file.extension}`;
    const destinationPath = path.resolve(this.uploadDir, serverFileName);

    // Path containment check (defense-in-depth against path traversal)
    if (!isPathContained(destinationPath, this.uploadDir)) {
      throw new AppException(
        'Đường dẫn lưu trữ không an toàn.',
        400,
        ErrorCode.INVALID_EVIDENCE,
      );
    }

    try {
      await fs.promises.writeFile(destinationPath, file.buffer);
    } catch {
      throw new AppException(
        'Không thể lưu hình ảnh minh chứng lên máy chủ.',
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
   * Safely resolves and validates containment for an evidence download.
   */
  async resolveEvidencePath(fileName: string): Promise<string> {
    if (
      !fileName ||
      fileName.includes('/') ||
      fileName.includes('\\') ||
      fileName.includes('..')
    ) {
      throw new AppException(
        'Tên tệp không hợp lệ.',
        400,
        ErrorCode.INVALID_EVIDENCE,
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
        'Hình ảnh minh chứng không tồn tại trên hệ thống lưu trữ.',
        404,
        ErrorCode.PETITION_EVIDENCE_NOT_FOUND,
      );
    }
  }
}
