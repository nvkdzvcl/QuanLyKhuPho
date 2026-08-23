import { describe, it, expect } from 'vitest';
import {
  ErrorCode,
  NotificationType,
  PetitionCategory,
  PetitionStatus,
} from '../src';

describe('Shared Petition Types and Enums', () => {
  it('should have all defined petition categories', () => {
    expect(PetitionCategory.INFRASTRUCTURE).toBe('infrastructure');
    expect(PetitionCategory.SANITATION).toBe('sanitation');
    expect(PetitionCategory.SECURITY).toBe('security');
    expect(PetitionCategory.OTHER).toBe('other');
  });

  it('should have all defined petition statuses', () => {
    expect(PetitionStatus.REVIEWING).toBe('reviewing');
    expect(PetitionStatus.PROCESSING).toBe('processing');
    expect(PetitionStatus.RESOLVED).toBe('resolved');
    expect(PetitionStatus.REJECTED).toBe('rejected');
    expect(PetitionStatus.CANCELLED).toBe('cancelled');
  });

  it('should have PETITION notification type', () => {
    expect(NotificationType.PETITION).toBe('petition');
  });

  it('should have petition-specific error codes', () => {
    expect(ErrorCode.PETITION_NOT_FOUND).toBe('PETITION_NOT_FOUND');
    expect(ErrorCode.PETITION_EVIDENCE_NOT_FOUND).toBe('PETITION_EVIDENCE_NOT_FOUND');
    expect(ErrorCode.INVALID_PETITION_TRANSITION).toBe('INVALID_PETITION_TRANSITION');
    expect(ErrorCode.PETITION_REJECTION_REASON_REQUIRED).toBe('PETITION_REJECTION_REASON_REQUIRED');
    expect(ErrorCode.PETITION_CANNOT_BE_CANCELLED).toBe('PETITION_CANNOT_BE_CANCELLED');
    expect(ErrorCode.TOO_MANY_PETITION_EVIDENCES).toBe('TOO_MANY_PETITION_EVIDENCES');
  });
});
