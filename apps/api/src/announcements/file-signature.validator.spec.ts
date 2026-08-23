import { describe, it, expect } from 'vitest';
import type { Readable } from 'stream';
import {
  sanitizeFileName,
  validateUploadedFile,
  validateUploadedFiles,
  MAX_ATTACHMENT_SIZE_BYTES,
} from './file-signature.validator';
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

describe('File Signature & Attachment Validator', () => {
  describe('sanitizeFileName', () => {
    it('should strip path traversal sequences', () => {
      expect(sanitizeFileName('../../etc/passwd')).toBe('passwd');
      expect(sanitizeFileName('..\\..\\windows\\system32\\calc.exe')).toBe('calc.exe');
      expect(sanitizeFileName('folder/subfolder/document.pdf')).toBe('document.pdf');
    });

    it('should strip null bytes and non-printable control characters', () => {
      expect(sanitizeFileName('test\0file\x01.pdf')).toBe('testfile.pdf');
    });

    it('should fallback to "attachment" for empty or dot-only names', () => {
      expect(sanitizeFileName('')).toBe('attachment');
      expect(sanitizeFileName('...')).toBe('attachment');
    });
  });

  describe('validateUploadedFile', () => {
    it('should accept a valid PDF file with %PDF- signature', () => {
      const pdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // %PDF-1.4
      const file = createMockMulterFile('report.pdf', 'application/pdf', pdfBuffer);

      const result = validateUploadedFile(file);
      expect(result.mimeType).toBe('application/pdf');
      expect(result.sanitizedName).toBe('report.pdf');
    });

    it('should accept valid PNG and JPEG files', () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
      const pngFile = createMockMulterFile('photo.png', 'image/png', pngBuffer);
      expect(validateUploadedFile(pngFile).sanitizedName).toBe('photo.png');

      const jpgBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      const jpgFile = createMockMulterFile('photo.jpg', 'image/jpeg', jpgBuffer);
      expect(validateUploadedFile(jpgFile).sanitizedName).toBe('photo.jpg');
    });

    it('should reject a spoofed file where content signature does not match declared MIME', () => {
      const fakePdfBuffer = Buffer.from('This is a fake pdf text content');
      const file = createMockMulterFile('fake.pdf', 'application/pdf', fakePdfBuffer);

      expect(() => validateUploadedFile(file)).toThrowError(AppException);
      try {
        validateUploadedFile(file);
      } catch (err: unknown) {
        if (err instanceof AppException) {
          expect(err.errorCode).toBe(ErrorCode.INVALID_FILE_TYPE);
        }
      }
    });

    it('should reject unsupported file types like executable scripts', () => {
      const exeBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00]); // MZ header
      const file = createMockMulterFile('malware.exe', 'application/x-msdownload', exeBuffer);

      expect(() => validateUploadedFile(file)).toThrowError(AppException);
    });

    it('should reject files exceeding 10 MiB', () => {
      const largeFile = createMockMulterFile(
        'large.pdf',
        'application/pdf',
        Buffer.alloc(10),
        MAX_ATTACHMENT_SIZE_BYTES + 1,
      );

      expect(() => validateUploadedFile(largeFile)).toThrowError(AppException);
      try {
        validateUploadedFile(largeFile);
      } catch (err: unknown) {
        if (err instanceof AppException) {
          expect(err.errorCode).toBe(ErrorCode.ATTACHMENT_TOO_LARGE);
        }
      }
    });

    it('should reject a file with mismatched extension (e.g. PDF uploaded as report.exe)', () => {
      const pdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
      const file = createMockMulterFile('report.exe', 'application/pdf', pdfBuffer);

      expect(() => validateUploadedFile(file)).toThrowError(AppException);
      try {
        validateUploadedFile(file);
      } catch (err: unknown) {
        if (err instanceof AppException) {
          expect(err.errorCode).toBe(ErrorCode.INVALID_FILE_TYPE);
        }
      }
    });

    it('should reject a file with no extension', () => {
      const pdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
      const file = createMockMulterFile('report', 'application/pdf', pdfBuffer);

      expect(() => validateUploadedFile(file)).toThrowError(AppException);
    });

    it('should accept valid files with canonical extensions (docx, xlsx, zip, txt)', () => {
      const zipBuffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00]);
      const docxFile = createMockMulterFile(
        'document.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        zipBuffer,
      );
      expect(validateUploadedFile(docxFile).extension).toBe('.docx');

      const xlsxFile = createMockMulterFile(
        'sheet.xlsx',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        zipBuffer,
      );
      expect(validateUploadedFile(xlsxFile).extension).toBe('.xlsx');

      const zipFile = createMockMulterFile('archive.zip', 'application/zip', zipBuffer);
      expect(validateUploadedFile(zipFile).extension).toBe('.zip');

      const txtBuffer = Buffer.from('Hello world plain text');
      const txtFile = createMockMulterFile('notes.txt', 'text/plain', txtBuffer);
      expect(validateUploadedFile(txtFile).extension).toBe('.txt');
    });

    it('should reject empty files (0 bytes)', () => {
      const emptyFile = createMockMulterFile('empty.pdf', 'application/pdf', Buffer.alloc(0), 0);

      expect(() => validateUploadedFile(emptyFile)).toThrowError(AppException);
    });
  });

  describe('validateUploadedFiles (Batch)', () => {
    it('should reject if more than 5 files are uploaded', () => {
      const pdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]);
      const validFile = createMockMulterFile('doc.pdf', 'application/pdf', pdfBuffer);

      const sixFiles = [validFile, validFile, validFile, validFile, validFile, validFile];
      expect(() => validateUploadedFiles(sixFiles)).toThrowError(AppException);
      try {
        validateUploadedFiles(sixFiles);
      } catch (err: unknown) {
        if (err instanceof AppException) {
          expect(err.errorCode).toBe(ErrorCode.TOO_MANY_ATTACHMENTS);
        }
      }
    });
  });
});
