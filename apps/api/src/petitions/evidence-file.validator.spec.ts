import { describe, it, expect } from 'vitest';
import type { Readable } from 'stream';
import {
  sanitizeEvidenceFileName,
  validateUploadedEvidenceFile,
  validateUploadedEvidenceFiles,
  MAX_EVIDENCE_SIZE_BYTES,
} from './evidence-file.validator';
import { AppException } from '../core/exceptions/app.exception';
import { ErrorCode } from '@quanlykhupho/shared-types';

function createMockMulterFile(
  originalname: string,
  mimetype: string,
  buffer: Buffer,
  size?: number,
): Express.Multer.File {
  return {
    fieldname: 'files',
    originalname,
    encoding: '7bit',
    mimetype,
    size: size !== undefined ? size : buffer.length,
    buffer,
    destination: '',
    filename: '',
    path: '',
    stream: null as unknown as Readable,
  };
}

describe('Petition Evidence Validator', () => {
  describe('sanitizeEvidenceFileName', () => {
    it('should strip path traversal sequences', () => {
      expect(sanitizeEvidenceFileName('../../etc/passwd.jpg')).toBe('passwd.jpg');
      expect(sanitizeEvidenceFileName('..\\..\\windows\\system32\\calc.png')).toBe('calc.png');
      expect(sanitizeEvidenceFileName('folder/subfolder/evidence.webp')).toBe('evidence.webp');
    });

    it('should strip null bytes and non-printable control characters', () => {
      expect(sanitizeEvidenceFileName('test\0photo\x01.png')).toBe('testphoto.png');
    });

    it('should fallback to default for empty or dot-only names', () => {
      expect(sanitizeEvidenceFileName('')).toBe('evidence.jpg');
      expect(sanitizeEvidenceFileName('...')).toBe('evidence.jpg');
    });
  });

  describe('validateUploadedEvidenceFile', () => {
    it('should accept valid JPEG images with 0xFF 0xD8 0xFF signature', () => {
      const jpgBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      const file = createMockMulterFile('photo.jpg', 'image/jpeg', jpgBuffer);

      const result = validateUploadedEvidenceFile(file);
      expect(result.mimeType).toBe('image/jpeg');
      expect(result.sanitizedName).toBe('photo.jpg');
    });

    it('should accept valid PNG images with PNG magic bytes', () => {
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
      ]);
      const file = createMockMulterFile('evidence.png', 'image/png', pngBuffer);

      const result = validateUploadedEvidenceFile(file);
      expect(result.mimeType).toBe('image/png');
      expect(result.sanitizedName).toBe('evidence.png');
    });

    it('should accept valid WebP images with RIFF/WEBP magic bytes', () => {
      // 12 bytes: RIFF (4 bytes) + file size (4 bytes) + WEBP (4 bytes)
      const webpBuffer = Buffer.from([
        0x52, 0x49, 0x46, 0x46, 0x20, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
      ]);
      const file = createMockMulterFile('evidence.webp', 'image/webp', webpBuffer);

      const result = validateUploadedEvidenceFile(file);
      expect(result.mimeType).toBe('image/webp');
      expect(result.sanitizedName).toBe('evidence.webp');
    });

    it('should reject non-image file formats (e.g. PDF, DOCX, ZIP, EXE)', () => {
      const pdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
      const file = createMockMulterFile('doc.pdf', 'application/pdf', pdfBuffer);

      expect(() => validateUploadedEvidenceFile(file)).toThrowError(AppException);
      try {
        validateUploadedEvidenceFile(file);
      } catch (err: unknown) {
        if (err instanceof AppException) {
          expect(err.errorCode).toBe(ErrorCode.INVALID_FILE_TYPE);
        }
      }
    });

    it('should reject spoofed image files where content signature does not match declared MIME', () => {
      const fakeJpgBuffer = Buffer.from('This is not a real JPEG file');
      const file = createMockMulterFile('fake.jpg', 'image/jpeg', fakeJpgBuffer);

      expect(() => validateUploadedEvidenceFile(file)).toThrowError(AppException);
      try {
        validateUploadedEvidenceFile(file);
      } catch (err: unknown) {
        if (err instanceof AppException) {
          expect(err.errorCode).toBe(ErrorCode.INVALID_FILE_TYPE);
        }
      }
    });

    it('should reject files exceeding 10 MiB limit', () => {
      const jpgBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
      const largeFile = createMockMulterFile(
        'large.jpg',
        'image/jpeg',
        jpgBuffer,
        MAX_EVIDENCE_SIZE_BYTES + 1,
      );

      expect(() => validateUploadedEvidenceFile(largeFile)).toThrowError(AppException);
      try {
        validateUploadedEvidenceFile(largeFile);
      } catch (err: unknown) {
        if (err instanceof AppException) {
          expect(err.errorCode).toBe(ErrorCode.EVIDENCE_TOO_LARGE);
        }
      }
    });

    it('should reject empty image files (0 bytes)', () => {
      const emptyFile = createMockMulterFile('empty.jpg', 'image/jpeg', Buffer.alloc(0), 0);
      expect(() => validateUploadedEvidenceFile(emptyFile)).toThrowError(AppException);
    });
  });

  describe('validateUploadedEvidenceFiles (Batch)', () => {
    it('should reject if more than 5 evidence files are uploaded', () => {
      const jpgBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
      const file = createMockMulterFile('photo.jpg', 'image/jpeg', jpgBuffer);

      const sixFiles = [file, file, file, file, file, file];
      expect(() => validateUploadedEvidenceFiles(sixFiles)).toThrowError(AppException);
      try {
        validateUploadedEvidenceFiles(sixFiles);
      } catch (err: unknown) {
        if (err instanceof AppException) {
          expect(err.errorCode).toBe(ErrorCode.TOO_MANY_PETITION_EVIDENCES);
        }
      }
    });

    it('should return empty array when no files are provided', () => {
      expect(validateUploadedEvidenceFiles(undefined)).toEqual([]);
      expect(validateUploadedEvidenceFiles([])).toEqual([]);
    });
  });
});
