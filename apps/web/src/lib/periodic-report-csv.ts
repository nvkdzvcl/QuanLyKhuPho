import {
  PeriodicReportResponseDto,
  ReportingPeriodType,
} from '@quanlykhupho/shared-types';

/**
 * Generates a clean, controlled filename for the CSV report download.
 * E.g. 'bao-cao-khu-pho-thang-08-2026.csv' or 'bao-cao-khu-pho-quy-3-2026.csv'
 */
export function generatePeriodicReportFilename(
  periodType: ReportingPeriodType,
  year: number,
  period: number,
): string {
  if (periodType === ReportingPeriodType.QUARTER) {
    return `bao-cao-khu-pho-quy-${period}-${year}.csv`;
  }
  const paddedMonth = String(period).padStart(2, '0');
  return `bao-cao-khu-pho-thang-${paddedMonth}-${year}.csv`;
}

/**
 * Escapes a single cell value for CSV output with protection against formula injection.
 * Strings starting with '=', '+', '-', or '@' (after optional leading whitespace) are prefixed with "'".
 * Fields containing commas, quotes, or newlines are wrapped in double quotes, with internal quotes doubled.
 */
export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  let str = String(value);

  // Prevent formula injection in spreadsheet applications (Excel, LibreOffice, Google Sheets)
  if (typeof value === 'string' && /^[\s\t]*[=+\-@\t]/.test(str)) {
    str = `'${str}`;
  }

  // Quote cell if it contains special characters: comma, double quote, newline, carriage return
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Builds a single CSV row from an array of values.
 */
export function buildCsvRow(cells: unknown[]): string {
  return cells.map((cell) => escapeCsvCell(cell)).join(',');
}

/**
 * Generates a UTF-8 BOM encoded CSV string for a periodic ward report.
 */
export function generatePeriodicReportCsv(
  report: PeriodicReportResponseDto,
): string {
  const lines: string[] = [];

  // Title
  lines.push(buildCsvRow(['BÁO CÁO ĐỊNH KỲ TÌNH HÌNH QUẢN LÝ ĐỊA BÀN PHƯỜNG']));
  lines.push('');

  // Report metadata section
  lines.push(buildCsvRow(['THÔNG TIN BÁO CÁO']));
  lines.push(buildCsvRow(['Kỳ báo cáo', report.label]));
  lines.push(
    buildCsvRow([
      'Loại kỳ',
      report.periodType === ReportingPeriodType.MONTH
        ? 'Hàng tháng'
        : 'Hàng quý',
    ]),
  );
  lines.push(buildCsvRow(['Năm', report.year]));
  lines.push(buildCsvRow(['Kỳ', report.period]));
  lines.push(buildCsvRow(['Thời gian bắt đầu (UTC)', report.startDate]));
  lines.push(
    buildCsvRow(['Mốc kết thúc loại trừ (UTC)', report.endDateExclusive]),
  );
  lines.push(buildCsvRow(['Thời điểm lập báo cáo (UTC)', report.generatedAt]));
  lines.push(
    buildCsvRow([
      'Đánh giá dữ liệu',
      report.isDataSufficient
        ? 'Đầy đủ'
        : 'Cần lưu ý / Dữ liệu có thể chưa hoàn tất',
    ]),
  );

  if (report.warnings.length > 0) {
    lines.push(buildCsvRow(['Cảnh báo', report.warnings.join('; ')]));
  }
  lines.push('');

  // Ward Summary section
  lines.push(buildCsvRow(['TỔNG HỢP TOÀN PHƯỜNG']));
  lines.push(buildCsvRow(['Chỉ số', 'Giá trị']));
  lines.push(
    buildCsvRow(['Số lượng khu phố trực thuộc', report.summary.neighborhoodCount]),
  );
  lines.push(
    buildCsvRow([
      'Số cư dân hoạt động (hiện tại)',
      report.summary.activeResidentCount,
    ]),
  );
  lines.push(
    buildCsvRow([
      'Số cư dân đăng ký mới trong kỳ',
      report.summary.newResidentRegistrationsCount,
    ]),
  );
  lines.push(
    buildCsvRow([
      'Số thông báo đã phát hành trong kỳ',
      report.summary.publishedAnnouncementsCount,
    ]),
  );
  lines.push(
    buildCsvRow([
      'Tổng số kiến nghị phát sinh trong kỳ',
      report.summary.petitionsByStatus.total,
    ]),
  );
  lines.push(
    buildCsvRow([
      '- Kiến nghị chờ tiếp nhận',
      report.summary.petitionsByStatus.reviewing,
    ]),
  );
  lines.push(
    buildCsvRow([
      '- Kiến nghị đang xử lý',
      report.summary.petitionsByStatus.processing,
    ]),
  );
  lines.push(
    buildCsvRow([
      '- Kiến nghị đã giải quyết',
      report.summary.petitionsByStatus.resolved,
    ]),
  );
  lines.push(
    buildCsvRow([
      '- Kiến nghị từ chối',
      report.summary.petitionsByStatus.rejected,
    ]),
  );
  lines.push(
    buildCsvRow([
      '- Kiến nghị đã hủy',
      report.summary.petitionsByStatus.cancelled,
    ]),
  );
  lines.push('');

  // Per-neighborhood table section
  lines.push(buildCsvRow(['CHI TIẾT THEO TỪNG KHU PHỐ']));
  lines.push(
    buildCsvRow([
      'Mã khu phố',
      'Tên khu phố',
      'Phường',
      'Cư dân hoạt động',
      'Đăng ký mới',
      'Thông báo đã phát',
      'Tổng kiến nghị',
      'Chờ tiếp nhận',
      'Đang xử lý',
      'Đã giải quyết',
      'Từ chối',
      'Đã hủy',
    ]),
  );

  for (const n of report.neighborhoods) {
    lines.push(
      buildCsvRow([
        n.code,
        n.name,
        n.ward,
        n.activeResidentCount,
        n.newResidentRegistrationsCount,
        n.publishedAnnouncementsCount,
        n.petitionsByStatus.total,
        n.petitionsByStatus.reviewing,
        n.petitionsByStatus.processing,
        n.petitionsByStatus.resolved,
        n.petitionsByStatus.rejected,
        n.petitionsByStatus.cancelled,
      ]),
    );
  }

  // Prepend UTF-8 BOM (\uFEFF)
  return '\uFEFF' + lines.join('\r\n');
}

/**
 * Triggers a client-side download of the periodic report CSV and immediately revokes the object URL.
 */
export function downloadPeriodicReportCsv(report: PeriodicReportResponseDto): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }
  const csvContent = generatePeriodicReportCsv(report);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const filename = generatePeriodicReportFilename(
    report.periodType,
    report.year,
    report.period,
  );

  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
