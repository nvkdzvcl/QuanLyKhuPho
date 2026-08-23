import { describe, expect, it } from 'vitest';
import {
  ExportFormat,
  Gender,
  PartyStatus,
} from '@quanlykhupho/shared-types';
import {
  buildExportParams,
  extractFilenameFromDisposition,
} from '../src/hooks/use-exports';

describe('Web export download helpers', () => {
  it('serializes active filters without dropping numeric zero values', () => {
    const params = buildExportParams({
      format: ExportFormat.XLSX,
      neighborhoodId: '88888888-8888-4888-8888-888888888881',
      gender: Gender.FEMALE,
      ageFrom: 0,
      ageTo: 18,
      partyStatus: PartyStatus.PARTY_MEMBER,
      search: 'Nguyễn',
    });

    expect(params.get('format')).toBe('xlsx');
    expect(params.get('ageFrom')).toBe('0');
    expect(params.get('ageTo')).toBe('18');
    expect(params.get('partyStatus')).toBe('party_member');
    expect(params.get('search')).toBe('Nguyễn');
  });

  it('prefers and decodes an RFC 5987 filename', () => {
    const filename = extractFilenameFromDisposition(
      "attachment; filename=report.xlsx; filename*=UTF-8''bao-cao-khu-pho.xlsx",
      'fallback.xlsx',
    );

    expect(filename).toBe('bao-cao-khu-pho.xlsx');
  });

  it('falls back safely when the response has no filename', () => {
    expect(extractFilenameFromDisposition(undefined, 'fallback.csv')).toBe(
      'fallback.csv',
    );
  });
});
