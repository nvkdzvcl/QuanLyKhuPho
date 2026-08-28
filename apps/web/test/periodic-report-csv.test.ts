import { describe, it, expect } from 'vitest';
import {
  PeriodicReportResponseDto,
  ReportingPeriodType,
} from '@quanlykhupho/shared-types';
import {
  escapeCsvCell,
  generatePeriodicReportCsv,
  generatePeriodicReportFilename,
} from '../src/lib/periodic-report-csv';

describe('Periodic Report CSV Utility', () => {
  const mockReport: PeriodicReportResponseDto = {
    periodType: ReportingPeriodType.MONTH,
    year: 2026,
    period: 8,
    label: 'Tháng 8/2026',
    startDate: '2026-08-01T00:00:00.000Z',
    endDateExclusive: '2026-09-01T00:00:00.000Z',
    generatedAt: '2026-08-23T10:14:47.000Z',
    isDataSufficient: true,
    warnings: [],
    summary: {
      neighborhoodCount: 2,
      activeResidentCount: 150,
      newResidentRegistrationsCount: 12,
      publishedAnnouncementsCount: 5,
      petitionsByStatus: {
        reviewing: 2,
        processing: 1,
        resolved: 6,
        rejected: 1,
        cancelled: 0,
        total: 10,
      },
    },
    neighborhoods: [
      {
        id: '99999999-9999-4999-9999-999999999991',
        code: 'KP-01',
        name: 'Khu phố 1',
        ward: 'Phường Bến Nghé',
        activeResidentCount: 80,
        newResidentRegistrationsCount: 7,
        publishedAnnouncementsCount: 3,
        petitionsByStatus: {
          reviewing: 1,
          processing: 1,
          resolved: 4,
          rejected: 0,
          cancelled: 0,
          total: 6,
        },
      },
      {
        id: '99999999-9999-4999-9999-999999999992',
        code: 'KP-02',
        name: 'Khu phố 2, Bến Nghé',
        ward: 'Phường Bến Nghé',
        activeResidentCount: 70,
        newResidentRegistrationsCount: 5,
        publishedAnnouncementsCount: 2,
        petitionsByStatus: {
          reviewing: 1,
          processing: 0,
          resolved: 2,
          rejected: 1,
          cancelled: 0,
          total: 4,
        },
      },
    ],
  };

  describe('generatePeriodicReportFilename', () => {
    it('should format monthly filenames with 2-digit zero-padded month', () => {
      expect(generatePeriodicReportFilename(ReportingPeriodType.MONTH, 2026, 8)).toBe(
        'bao-cao-khu-pho-thang-08-2026.csv',
      );
      expect(generatePeriodicReportFilename(ReportingPeriodType.MONTH, 2026, 12)).toBe(
        'bao-cao-khu-pho-thang-12-2026.csv',
      );
      expect(
        generatePeriodicReportFilename(ReportingPeriodType.MONTH, 2026, 1),
      ).toBe('bao-cao-khu-pho-thang-01-2026.csv');
    });

    it('should format quarterly filenames with quarter index', () => {
      expect(generatePeriodicReportFilename(ReportingPeriodType.QUARTER, 2026, 3)).toBe(
        'bao-cao-khu-pho-quy-3-2026.csv',
      );
      expect(
        generatePeriodicReportFilename(ReportingPeriodType.QUARTER, 2026, 1),
      ).toBe('bao-cao-khu-pho-quy-1-2026.csv');
    });
  });

  describe('escapeCsvCell', () => {
    it('should return plain text as-is when no special characters', () => {
      expect(escapeCsvCell('Khu phố 1')).toBe('Khu phố 1');
      expect(escapeCsvCell(150)).toBe('150');
      expect(escapeCsvCell(0)).toBe('0');
      expect(escapeCsvCell(null)).toBe('');
      expect(escapeCsvCell(undefined)).toBe('');
    });

    it('should wrap in quotes and escape internal quotes if comma, quotes, or newlines present', () => {
      expect(escapeCsvCell('Khu phố 1, 2')).toBe('"Khu phố 1, 2"');
      expect(escapeCsvCell('Tổ "1" Đoàn Kết')).toBe('"Tổ ""1"" Đoàn Kết"');
      expect(escapeCsvCell('Dòng 1\nDòng 2')).toBe('"Dòng 1\nDòng 2"');
    });

    it('should prevent spreadsheet formula injection by prefixing with apostrophe', () => {
      expect(escapeCsvCell('=SUM(A1:B10)')).toBe("'=SUM(A1:B10)");
      expect(escapeCsvCell('+123456789')).toBe("'+123456789");
      expect(escapeCsvCell('-2+5')).toBe("'-2+5");
      expect(escapeCsvCell('@SUM(A1:B10)')).toBe("'@SUM(A1:B10)");
      expect(escapeCsvCell('  =1+1')).toBe("'  =1+1");
      expect(escapeCsvCell('\t=1+1')).toBe("'\t=1+1");
      expect(escapeCsvCell('\t+999')).toBe("'\t+999");
      expect(escapeCsvCell('\t-888')).toBe("'\t-888");
      expect(escapeCsvCell('\t@SUM(1,2)')).toBe("\"'\t@SUM(1,2)\"");
      expect(escapeCsvCell('@SUM(1,2)')).toBe("\"'@SUM(1,2)\"");
      expect(escapeCsvCell('=1+1,2')).toBe("\"'=1+1,2\"");
    });

    it('should preserve numeric values without single-quote prefix', () => {
      expect(escapeCsvCell(0)).toBe('0');
      expect(escapeCsvCell(42)).toBe('42');
      expect(escapeCsvCell(-10)).toBe('-10');
    });
  });

  describe('generatePeriodicReportCsv', () => {
    it('should produce UTF-8 BOM at the beginning', () => {
      const csv = generatePeriodicReportCsv(mockReport);
      expect(csv.startsWith('\uFEFF')).toBe(true);
    });

    it('should include report title, metadata, summary, and neighborhood table', () => {
      const csv = generatePeriodicReportCsv(mockReport);

      // Section titles
      expect(csv).toContain('BÁO CÁO ĐỊNH KỲ TÌNH HÌNH QUẢN LÝ ĐỊA BÀN PHƯỜNG');
      expect(csv).toContain('THÔNG TIN BÁO CÁO');
      expect(csv).toContain('TỔNG HỢP TOÀN PHƯỜNG');
      expect(csv).toContain('CHI TIẾT THEO TỪNG KHU PHỐ');

      // Metadata
      expect(csv).toContain('Tháng 8/2026');
      expect(csv).toContain('2026-08-01T00:00:00.000Z');
      expect(csv).toContain('2026-09-01T00:00:00.000Z');
      expect(csv).toContain('Đầy đủ');

      // Summary
      expect(csv).toContain('Số lượng khu phố trực thuộc,2');
      expect(csv).toContain('Số cư dân hoạt động (hiện tại),150');
      expect(csv).toContain('Số cư dân đăng ký mới trong kỳ,12');
      expect(csv).toContain('Số thông báo đã phát hành trong kỳ,5');
      expect(csv).toContain('Tổng số kiến nghị phát sinh trong kỳ,10');

      // Table rows
      expect(csv).toContain('KP-01,Khu phố 1,Phường Bến Nghé,80,7,3,6,1,1,4,0,0');
      expect(csv).toContain(
        'KP-02,"Khu phố 2, Bến Nghé",Phường Bến Nghé,70,5,2,4,1,0,2,1,0',
      );
    });

    it('should correctly format quarterly reports', () => {
      const quarterlyReport: PeriodicReportResponseDto = {
        ...mockReport,
        periodType: ReportingPeriodType.QUARTER,
        period: 3,
        label: 'Quý 3/2026',
        startDate: '2026-07-01T00:00:00.000Z',
        endDateExclusive: '2026-10-01T00:00:00.000Z',
      };

      const csv = generatePeriodicReportCsv(quarterlyReport);
      expect(csv).toContain('Quý 3/2026');
      expect(csv).toContain('Hàng quý');
      expect(csv).toContain('2026-07-01T00:00:00.000Z');
      expect(csv).toContain('2026-10-01T00:00:00.000Z');
    });

    it('should handle reports with zero neighborhoods gracefully', () => {
      const emptyReport: PeriodicReportResponseDto = {
        periodType: ReportingPeriodType.MONTH,
        year: 2026,
        period: 1,
        label: 'Tháng 1/2026',
        startDate: '2026-01-01T00:00:00.000Z',
        endDateExclusive: '2026-02-01T00:00:00.000Z',
        generatedAt: '2026-01-15T00:00:00.000Z',
        isDataSufficient: false,
        warnings: ['Chưa có khu phố nào trong hệ thống'],
        summary: {
          neighborhoodCount: 0,
          activeResidentCount: 0,
          newResidentRegistrationsCount: 0,
          publishedAnnouncementsCount: 0,
          petitionsByStatus: {
            reviewing: 0,
            processing: 0,
            resolved: 0,
            rejected: 0,
            cancelled: 0,
            total: 0,
          },
        },
        neighborhoods: [],
      };

      const csv = generatePeriodicReportCsv(emptyReport);
      expect(csv.startsWith('\uFEFF')).toBe(true);
      expect(csv).toContain('Số lượng khu phố trực thuộc,0');
      expect(csv).toContain('CHI TIẾT THEO TỪNG KHU PHỐ');
      expect(csv).toContain('Chưa có khu phố nào trong hệ thống');
    });

    it('should include warnings when present and escape special characters', () => {
      const reportWithWarnings: PeriodicReportResponseDto = {
        ...mockReport,
        isDataSufficient: false,
        warnings: [
          'Kỳ báo cáo đang diễn ra, số liệu tổng hợp có thể tiếp tục thay đổi đến hết kỳ.',
          'Dữ liệu "thực tế" chưa đối soát 100%.',
        ],
      };

      const csv = generatePeriodicReportCsv(reportWithWarnings);
      expect(csv).toContain('Cần lưu ý / Dữ liệu có thể chưa hoàn tất');
      expect(csv).toContain('Kỳ báo cáo đang diễn ra');
      expect(csv).toContain('Dữ liệu ""thực tế"" chưa đối soát 100%.');
    });

    it('should not contain any person-level or sensitive fields', () => {
      const csv = generatePeriodicReportCsv(mockReport);
      expect(csv).not.toContain('phone');
      expect(csv).not.toContain('citizenId');
      expect(csv).not.toContain('password');
      expect(csv).not.toContain('090');
      expect(csv).not.toContain('098');
    });
  });
});
