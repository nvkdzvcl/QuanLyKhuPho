import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { ConfigService } from '@nestjs/config';
import { PetitionEvidenceStorageService } from './petition-evidence-storage.service';
import { AppException } from '../core/exceptions/app.exception';
import { ErrorCode } from '@quanlykhupho/shared-types';
import { ValidatedEvidenceFile } from './evidence-file.validator';

describe('PetitionEvidenceStorageService', () => {
  let tempDir: string;
  let service: PetitionEvidenceStorageService;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'pet-ev-test-'));
    const configServiceMock = {
      get: vi.fn((key: string) => {
        if (key === 'UPLOAD_DIR') return tempDir;
        return null;
      }),
    } as unknown as ConfigService;

    service = new PetitionEvidenceStorageService(configServiceMock);
    await service.onModuleInit();
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should save evidence image safely to disk and return metadata', async () => {
    const file: ValidatedEvidenceFile = {
      originalName: 'pothole.jpg',
      sanitizedName: 'pothole.jpg',
      mimeType: 'image/jpeg',
      size: 6,
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
      extension: '.jpg',
    };

    const result = await service.saveEvidence(file);
    expect(result.originalName).toBe('pothole.jpg');
    expect(result.mimeType).toBe('image/jpeg');
    expect(result.fileName.endsWith('.jpg')).toBe(true);
    expect(fs.existsSync(result.filePath)).toBe(true);
  });

  it('should clean up staged files from disk during rollback', async () => {
    const uploadPetitionsDir = path.join(tempDir, 'petitions');
    await fs.promises.mkdir(uploadPetitionsDir, { recursive: true });
    const filePath = path.join(uploadPetitionsDir, 'test-cleanup.jpg');
    await fs.promises.writeFile(filePath, 'temp-image-data');
    expect(fs.existsSync(filePath)).toBe(true);

    await service.cleanupFiles([filePath]);
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it('should reject invalid or path traversal file names in resolveEvidencePath', async () => {
    await expect(service.resolveEvidencePath('../etc/passwd')).rejects.toThrowError(
      AppException,
    );
    await expect(service.resolveEvidencePath('sub/file.jpg')).rejects.toThrowError(
      AppException,
    );
    await expect(service.resolveEvidencePath('')).rejects.toThrowError(AppException);
  });

  it('should resolve existing evidence path correctly', async () => {
    const uploadPetitionsDir = path.join(tempDir, 'petitions');
    await fs.promises.mkdir(uploadPetitionsDir, { recursive: true });
    const fileName = 'valid-evidence.png';
    const fullPath = path.join(uploadPetitionsDir, fileName);
    await fs.promises.writeFile(fullPath, 'image-bytes');

    const resolved = await service.resolveEvidencePath(fileName);
    expect(resolved).toBe(fullPath);
  });

  it('should throw 404 PETITION_EVIDENCE_NOT_FOUND when evidence file does not exist', async () => {
    try {
      await service.resolveEvidencePath('non-existent.jpg');
      expect.unreachable('Should have thrown');
    } catch (err: unknown) {
      if (err instanceof AppException) {
        expect(err.errorCode).toBe(ErrorCode.PETITION_EVIDENCE_NOT_FOUND);
        expect(err.getStatus()).toBe(404);
      }
    }
  });
});
