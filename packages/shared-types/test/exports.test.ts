import { describe, it, expect } from 'vitest';
import {
  ErrorCode,
  ExportDataset,
  ExportFormat,
  ExportQueryDto,
  HIGHEST_EDUCATION_RANK,
  HighestEducation,
} from '../src';

describe('Shared Export Types and Contracts', () => {
  it('should define all 4 export datasets', () => {
    expect(ExportDataset.RESIDENTS).toBe('residents');
    expect(ExportDataset.POLITICAL_SOCIAL).toBe('political_social');
    expect(ExportDataset.ACTIVITIES).toBe('activities');
    expect(ExportDataset.PETITIONS).toBe('petitions');
  });

  it('should define CSV and XLSX formats', () => {
    expect(ExportFormat.CSV).toBe('csv');
    expect(ExportFormat.XLSX).toBe('xlsx');
  });

  it('should maintain strict education rank order', () => {
    expect(HIGHEST_EDUCATION_RANK).toEqual([
      HighestEducation.LOWER_SECONDARY,
      HighestEducation.UPPER_SECONDARY,
      HighestEducation.VOCATIONAL,
      HighestEducation.COLLEGE,
      HighestEducation.BACHELOR,
      HighestEducation.MASTER,
      HighestEducation.DOCTORATE,
    ]);
  });

  it('should define export error codes', () => {
    expect(ErrorCode.EXPORT_LIMIT_EXCEEDED).toBe('EXPORT_LIMIT_EXCEEDED');
    expect(ErrorCode.EXTRACTION_LIMIT_EXCEEDED).toBe('EXTRACTION_LIMIT_EXCEEDED');
    expect(ErrorCode.INVALID_EXPORT_DATASET).toBe('INVALID_EXPORT_DATASET');
    expect(ErrorCode.INVALID_EXPORT_FORMAT).toBe('INVALID_EXPORT_FORMAT');
  });

  it('should conform to ExportQueryDto structure', () => {
    const query: ExportQueryDto = {
      format: ExportFormat.CSV,
      neighborhoodId: 'neigh-1',
      search: 'Nguyen',
      ageFrom: 18,
      ageTo: 65,
    };

    expect(query.format).toBe(ExportFormat.CSV);
    expect(query.ageFrom).toBe(18);
  });
});
