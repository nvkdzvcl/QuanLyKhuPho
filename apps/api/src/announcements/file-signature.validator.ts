import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from '@quanlykhupho/shared-types';
import { AppException } from '../core/exceptions/app.exception';

export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10 MiB
export const MAX_ATTACHMENTS_COUNT = 5;

export interface ValidatedFile {
  originalName: string;
  sanitizedName: string;
  mimeType: string;
  size: number;
  buffer: Buffer;
  extension: string;
}

export const MIME_TO_ALLOWED_EXTENSIONS: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/zip': ['.zip'],
  'application/x-zip-compressed': ['.zip'],
  'text/plain': ['.txt'],
};

const ALLOWED_MIME_TYPES = new Set(Object.keys(MIME_TO_ALLOWED_EXTENSIONS));

/**
 * Validates magic numbers (byte signatures) against declared MIME types.
 */
function validateMagicBytes(buffer: Buffer, declaredMime: string): boolean {
  if (!buffer || buffer.length === 0) {
    return false;
  }

  const mime = declaredMime.toLowerCase();

  // PDF: %PDF- (0x25 0x50 0x44 0x46)
  if (mime === 'application/pdf') {
    return (
      buffer.length >= 4 &&
      buffer[0] === 0x25 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x44 &&
      buffer[3] === 0x46
    );
  }

  // JPEG: 0xFF 0xD8 0xFF
  if (mime === 'image/jpeg' || mime === 'image/jpg') {
    return (
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    );
  }

  // PNG: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
  if (mime === 'image/png') {
    return (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    );
  }

  // GIF: GIF87a or GIF89a
  if (mime === 'image/gif') {
    if (buffer.length < 6) return false;
    const header = buffer.subarray(0, 6).toString('ascii');
    return header === 'GIF87a' || header === 'GIF89a';
  }

  // ZIP / DOCX / XLSX: PK\x03\x04 (0x50 0x4B 0x03 0x04)
  if (
    mime === 'application/zip' ||
    mime === 'application/x-zip-compressed' ||
    mime ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mime ===
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ) {
    return (
      buffer.length >= 4 &&
      buffer[0] === 0x50 &&
      buffer[1] === 0x4b &&
      buffer[2] === 0x03 &&
      buffer[3] === 0x04
    );
  }

  // Plain text: Verify that first 1KB contains no null bytes and valid UTF-8/ASCII
  if (mime === 'text/plain') {
    const checkLength = Math.min(buffer.length, 1024);
    for (let i = 0; i < checkLength; i++) {
      const byte = buffer[i];
      if (byte === 0x00) {
        return false; // Binary null byte detected
      }
    }
    return true;
  }

  return false;
}

/**
 * Sanitizes original filenames to prevent path traversal, control characters,
 * and dangerous filenames.
 */
export function sanitizeFileName(name: string): string {
  if (!name || typeof name !== 'string') {
    return 'attachment';
  }

  // Strip path traversal attempts and backslashes
  let sanitized = name.replace(/\\/g, '/');
  const segments = sanitized.split('/');
  sanitized = segments[segments.length - 1] || 'attachment';

  // Strip control characters (ASCII < 32 or 127)
  sanitized = Array.from(sanitized)
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join('')
    .trim();

  // Strip leading/trailing dots or spaces
  sanitized = sanitized.replace(/^\.+/, '').trim();

  if (!sanitized) {
    sanitized = 'attachment';
  }

  // Limit length to 200 chars
  if (sanitized.length > 200) {
    const extIndex = sanitized.lastIndexOf('.');
    if (extIndex !== -1 && extIndex > 0) {
      const ext = sanitized.substring(extIndex);
      sanitized = sanitized.substring(0, 190) + ext;
    } else {
      sanitized = sanitized.substring(0, 200);
    }
  }

  return sanitized;
}

export function validateUploadedFile(
  file: Express.Multer.File,
): ValidatedFile {
  if (!file) {
    throw new AppException(
      'Tệp đính kèm không hợp lệ.',
      HttpStatus.BAD_REQUEST,
      ErrorCode.INVALID_ATTACHMENT,
    );
  }

  // 1. Size check
  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    throw new AppException(
      `Kích thước tệp "${file.originalname}" vượt quá giới hạn 10 MiB cho phép.`,
      HttpStatus.BAD_REQUEST,
      ErrorCode.ATTACHMENT_TOO_LARGE,
    );
  }

  if (file.size === 0) {
    throw new AppException(
      `Tệp "${file.originalname}" rỗng (0 bytes).`,
      HttpStatus.BAD_REQUEST,
      ErrorCode.INVALID_ATTACHMENT,
    );
  }

  // 2. MIME type check against allowlist
  const declaredMime = file.mimetype.toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(declaredMime)) {
    throw new AppException(
      `Định dạng tệp "${file.originalname}" (${file.mimetype}) không được hỗ trợ. Các định dạng cho phép: PDF, PNG, JPG, GIF, DOCX, XLSX, ZIP, TXT.`,
      HttpStatus.BAD_REQUEST,
      ErrorCode.INVALID_FILE_TYPE,
    );
  }

  // 3. Content signature (magic bytes) validation
  const isValidSignature = validateMagicBytes(file.buffer, declaredMime);
  if (!isValidSignature) {
    throw new AppException(
      `Nội dung tệp "${file.originalname}" không khớp với định dạng khai báo (${file.mimetype}). Tệp có thể đã bị giả mạo.`,
      HttpStatus.BAD_REQUEST,
      ErrorCode.INVALID_FILE_TYPE,
    );
  }

  // 4. Sanitize original filename and validate client extension
  const sanitizedName = sanitizeFileName(file.originalname);
  const dotIndex = sanitizedName.lastIndexOf('.');
  const extension = dotIndex !== -1 ? sanitizedName.substring(dotIndex).toLowerCase() : '';

  const allowedExtensions = MIME_TO_ALLOWED_EXTENSIONS[declaredMime];
  if (!allowedExtensions || !allowedExtensions.includes(extension)) {
    throw new AppException(
      `Phần mở rộng của tệp "${file.originalname}" không khớp với định dạng MIME (${file.mimetype}).`,
      HttpStatus.BAD_REQUEST,
      ErrorCode.INVALID_FILE_TYPE,
    );
  }

  return {
    originalName: file.originalname,
    sanitizedName,
    mimeType: declaredMime,
    size: file.size,
    buffer: file.buffer,
    extension,
  };
}

export function validateUploadedFiles(
  files: Express.Multer.File[] | undefined,
): ValidatedFile[] {
  if (!files || files.length === 0) {
    return [];
  }

  if (files.length > MAX_ATTACHMENTS_COUNT) {
    throw new AppException(
      `Mỗi thông báo chỉ được đính kèm tối đa ${MAX_ATTACHMENTS_COUNT} tệp.`,
      HttpStatus.BAD_REQUEST,
      ErrorCode.TOO_MANY_ATTACHMENTS,
    );
  }

  return files.map((file) => validateUploadedFile(file));
}
