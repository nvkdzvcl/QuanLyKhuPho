import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { ConfigService } from '@nestjs/config';
import {
  AttachmentStorageService,
  isPathContained,
} from './attachment-storage.service';
import { AppException } from '../core/exceptions/app.exception';
import { ErrorCode } from '@quanlykhupho/shared-types';
import { ValidatedFile } from './file-signature.validator';

describe('AttachmentStorageService & Path Containment', () => {
  describe('isPathContained', () => {
    const baseDir = path.resolve('/var/app/uploads');

    it('should return true for files and subdirectories within parentDir', () => {
      const childFile = path.resolve('/var/app/uploads/file.pdf');
      const nestedFile = path.resolve('/var/app/uploads/sub/file.pdf');

      expect(isPathContained(childFile, baseDir)).toBe(true);
      expect(isPathContained(nestedFile, baseDir)).toBe(true);
    });

    it('should return false for sibling directories with matching prefix', () => {
      const siblingFile = path.resolve('/var/app/uploads_malicious/file.pdf');
      expect(isPathContained(siblingFile, baseDir)).toBe(false);
    });

    it('should return false for path traversal sequences', () => {
      const traversal = path.resolve('/var/app/uploads/../secret.txt');
      expect(isPathContained(traversal, baseDir)).toBe(false);
    });

    it('should return false when target path is identical to parent directory', () => {
      expect(isPathContained(baseDir, baseDir)).toBe(false);
    });
  });

  describe('AttachmentStorageService operations', () => {
    let tempDir: string;
    let service: AttachmentStorageService;

    beforeEach(async () => {
      tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'att-test-'));
      const configServiceMock = {
        get: vi.fn((key: string) => {
          if (key === 'UPLOAD_DIR') return tempDir;
          return null;
        }),
      } as unknown as ConfigService;

      service = new AttachmentStorageService(configServiceMock);
      await service.onModuleInit();
    });

    afterEach(async () => {
      try {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    });

    it('should save attachment safely to disk and return metadata', async () => {
      const file: ValidatedFile = {
        originalName: 'report.pdf',
        sanitizedName: 'report.pdf',
        mimeType: 'application/pdf',
        size: 14,
        buffer: Buffer.from('%PDF-1.4 sample'),
        extension: '.pdf',
      };

      const result = await service.saveAttachment(file);
      expect(result.originalName).toBe('report.pdf');
      expect(result.mimeType).toBe('application/pdf');
      expect(result.fileName.endsWith('.pdf')).toBe(true);
      expect(fs.existsSync(result.filePath)).toBe(true);
    });

    it('should clean up staged files from disk', async () => {
      const filePath = path.join(tempDir, 'test-cleanup.pdf');
      await fs.promises.writeFile(filePath, 'temp-data');
      expect(fs.existsSync(filePath)).toBe(true);

      await service.cleanupFiles([filePath]);
      expect(fs.existsSync(filePath)).toBe(false);
    });

    it('should reject invalid or malicious file names in resolveAttachmentPath', async () => {
      await expect(service.resolveAttachmentPath('../etc/passwd')).rejects.toThrowError(
        AppException,
      );
      await expect(service.resolveAttachmentPath('sub/file.pdf')).rejects.toThrowError(
        AppException,
      );
      await expect(service.resolveAttachmentPath('')).rejects.toThrowError(AppException);
    });

    it('should resolve existing attachment path correctly', async () => {
      const fileName = 'valid-test.pdf';
      const fullPath = path.join(tempDir, fileName);
      await fs.promises.writeFile(fullPath, 'content');

      const resolved = await service.resolveAttachmentPath(fileName);
      expect(resolved).toBe(fullPath);
    });

    it('should throw 404 ATTACHMENT_NOT_FOUND when file does not exist', async () => {
      try {
        await service.resolveAttachmentPath('non-existent.pdf');
        expect.unreachable('Should have thrown');
      } catch (err: unknown) {
        if (err instanceof AppException) {
          expect(err.errorCode).toBe(ErrorCode.ATTACHMENT_NOT_FOUND);
          expect(err.getStatus()).toBe(404);
        }
      }
    });
  });
});
