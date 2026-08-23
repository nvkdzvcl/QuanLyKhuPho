import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from '@quanlykhupho/shared-types';
import { AppException } from '../core/exceptions/app.exception';

export const MAX_EVIDENCE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MiB
export const MAX_EVIDENCE_COUNT = 5;

export interface ValidatedEvidenceFile {
  originalName: string;
  sanitizedName: string;
  mimeType: string;
  size: number;
  buffer: Buffer;
  extension: string;
}

export const EVIDENCE_MIME_TO_ALLOWED_EXTENSIONS: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
};

const ALLOWED_EVIDENCE_MIME_TYPES = new Set(
  Object.keys(EVIDENCE_MIME_TO_ALLOWED_EXTENSIONS),
);

/**
 * Validates magic numbers (byte signatures) against declared image MIME types (JPEG, PNG, WebP).
 */
export function validateEvidenceMagicBytes(
  buffer: Buffer,
  declaredMime: string,
): boolean {
  if (!buffer || buffer.length === 0) {
    return false;
  }

  const mime = declaredMime.toLowerCase();

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

  // WebP: RIFF header (bytes 0-3: 0x52 0x49 0x46 0x46) and WEBP identifier (bytes 8-11: 0x57 0x42 0x45 0x50)
  if (mime === 'image/webp') {
    return (
      buffer.length >= 12 &&
      buffer[0] === 0x52 && // R
      buffer[1] === 0x49 && // I
      buffer[2] === 0x46 && // F
      buffer[3] === 0x46 && // F
      buffer[8] === 0x57 && // W
      buffer[9] === 0x45 && // E
      buffer[10] === 0x42 && // B
      buffer[11] === 0x50 // P
    );
  }

  return false;
}

/**
 * Sanitizes original filenames to prevent path traversal, control characters,
 * and dangerous characters.
 */
export function sanitizeEvidenceFileName(name: string): string {
  if (!name || typeof name !== 'string') {
    return 'evidence.jpg';
  }

  // Strip path traversal attempts and backslashes
  let sanitized = name.replace(/\\/g, '/');
  const segments = sanitized.split('/');
  sanitized = segments[segments.length - 1] || 'evidence.jpg';

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
    sanitized = 'evidence.jpg';
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

export function validateUploadedEvidenceFile(
  file: Express.Multer.File,
): ValidatedEvidenceFile {
  if (!file) {
    throw new AppException(
      'Tệp hình ảnh minh chứng không hợp lệ.',
      HttpStatus.BAD_REQUEST,
      ErrorCode.INVALID_EVIDENCE,
    );
  }

  // 1. Size check
  if (file.size > MAX_EVIDENCE_SIZE_BYTES) {
    throw new AppException(
      `Kích thước hình ảnh "${file.originalname}" vượt quá giới hạn 10 MiB cho phép.`,
      HttpStatus.BAD_REQUEST,
      ErrorCode.EVIDENCE_TOO_LARGE,
    );
  }

  if (file.size === 0) {
    throw new AppException(
      `Tệp hình ảnh "${file.originalname}" rỗng (0 bytes).`,
      HttpStatus.BAD_REQUEST,
      ErrorCode.INVALID_EVIDENCE,
    );
  }

  // 2. MIME type check against image allowlist
  const declaredMime = file.mimetype.toLowerCase();
  if (!ALLOWED_EVIDENCE_MIME_TYPES.has(declaredMime)) {
    throw new AppException(
      `Định dạng tệp "${file.originalname}" (${file.mimetype}) không được hỗ trợ. Minh chứng chỉ chấp nhận hình ảnh JPEG, PNG, hoặc WebP.`,
      HttpStatus.BAD_REQUEST,
      ErrorCode.INVALID_FILE_TYPE,
    );
  }

  // 3. Content signature (magic bytes) validation
  const isValidSignature = validateEvidenceMagicBytes(file.buffer, declaredMime);
  if (!isValidSignature) {
    throw new AppException(
      `Nội dung tệp "${file.originalname}" không khớp với định dạng hình ảnh khai báo (${file.mimetype}). Tệp có thể đã bị giả mạo.`,
      HttpStatus.BAD_REQUEST,
      ErrorCode.INVALID_FILE_TYPE,
    );
  }

  // 4. Sanitize original filename and validate client extension
  const sanitizedName = sanitizeEvidenceFileName(file.originalname);
  const dotIndex = sanitizedName.lastIndexOf('.');
  const extension =
    dotIndex !== -1 ? sanitizedName.substring(dotIndex).toLowerCase() : '';

  const allowedExtensions = EVIDENCE_MIME_TO_ALLOWED_EXTENSIONS[declaredMime];
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

export function validateUploadedEvidenceFiles(
  files: Express.Multer.File[] | undefined,
): ValidatedEvidenceFile[] {
  if (!files || files.length === 0) {
    return [];
  }

  if (files.length > MAX_EVIDENCE_COUNT) {
    throw new AppException(
      `Mỗi kiến nghị chỉ được đính kèm tối đa ${MAX_EVIDENCE_COUNT} hình ảnh minh chứng.`,
      HttpStatus.BAD_REQUEST,
      ErrorCode.TOO_MANY_PETITION_EVIDENCES,
    );
  }

  return files.map((file) => validateUploadedEvidenceFile(file));
}
