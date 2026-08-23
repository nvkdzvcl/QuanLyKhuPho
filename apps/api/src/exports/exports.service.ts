import { HttpStatus, Injectable } from '@nestjs/common';
import type { Response } from 'express';
import {
  PetitionCategory as DbPetitionCategory,
  PetitionStatus as DbPetitionStatus,
  Prisma,
} from '@prisma/client';
import {
  ActivityFilterCondition,
  ErrorCode,
  ExportDataset,
  ExportFormat,
  Gender,
  HighestEducation,
  PartyStatus,
  PetitionCategory,
  PetitionStatus,
  UserDto,
  UserRole,
} from '@quanlykhupho/shared-types';
import { AppException } from '../core/exceptions/app.exception';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../security/crypto.service';
import { maskCitizenId, maskEmail } from '../security/citizen-id-utils';
import { maskPhoneNumber } from '../security/phone-utils';
import { buildResidentWhereInput } from '../resident-profiles/resident-profile-filter.utils';
import { ExportQueryDto } from './dto/export-query.dto';
import { generateCsv } from './helpers/csv-exporter';
import { generateXlsx, XlsxColumnDef } from './helpers/xlsx-exporter';

const GENDER_LABELS: Record<Gender, string> = {
  [Gender.MALE]: 'Nam',
  [Gender.FEMALE]: 'Nữ',
  [Gender.OTHER]: 'Khác',
};

const PARTY_STATUS_LABELS: Record<PartyStatus, string> = {
  [PartyStatus.PARTY_MEMBER]: 'Đảng viên',
  [PartyStatus.UNDER_CONSIDERATION]: 'Đang xem xét',
  [PartyStatus.NOT_MEMBER]: 'Chưa vào Đảng',
};

const EDUCATION_LABELS: Record<HighestEducation, string> = {
  [HighestEducation.LOWER_SECONDARY]: 'Trung học cơ sở (THCS)',
  [HighestEducation.UPPER_SECONDARY]: 'Trung học phổ thông (THPT)',
  [HighestEducation.VOCATIONAL]: 'Trung cấp nghề / Sơ cấp',
  [HighestEducation.COLLEGE]: 'Cao đẳng',
  [HighestEducation.BACHELOR]: 'Đại học / Cử nhân',
  [HighestEducation.MASTER]: 'Thạc sĩ',
  [HighestEducation.DOCTORATE]: 'Tiến sĩ',
};

const ACTIVITY_FILTER_LABELS: Record<ActivityFilterCondition, string> = {
  [ActivityFilterCondition.ALL]: 'Tất cả nhân khẩu',
  [ActivityFilterCondition.UNDER_18]: 'Dưới 18 tuổi',
  [ActivityFilterCondition.OVER_18]: 'Trên 18 tuổi',
  [ActivityFilterCondition.PARTY_MEMBER]: 'Đảng viên',
  [ActivityFilterCondition.CUSTOM]: 'Danh sách tùy chọn',
};

const PETITION_CATEGORY_LABELS: Record<PetitionCategory, string> = {
  [PetitionCategory.INFRASTRUCTURE]: 'Cơ sở hạ tầng',
  [PetitionCategory.SANITATION]: 'Vệ sinh môi trường',
  [PetitionCategory.SECURITY]: 'An ninh trật tự',
  [PetitionCategory.OTHER]: 'Khác',
};

const PETITION_STATUS_LABELS: Record<PetitionStatus, string> = {
  [PetitionStatus.REVIEWING]: 'Chờ tiếp nhận',
  [PetitionStatus.PROCESSING]: 'Đang xử lý',
  [PetitionStatus.RESOLVED]: 'Đã giải quyết',
  [PetitionStatus.REJECTED]: 'Từ chối',
  [PetitionStatus.CANCELLED]: 'Đã hủy',
};

const MAX_EXPORT_ROWS = 10_000;

function assertExportRowLimit(total: number): void {
  if (total > MAX_EXPORT_ROWS) {
    throw new AppException(
      `Số lượng bản ghi (${total}) vượt quá giới hạn xuất dữ liệu tối đa 10.000 dòng. Vui lòng thu hẹp bộ lọc.`,
      HttpStatus.BAD_REQUEST,
      ErrorCode.EXPORT_LIMIT_EXCEEDED,
    );
  }
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = d.getUTCFullYear();
  const hours = String(d.getUTCHours()).padStart(2, '0');
  const minutes = String(d.getUTCMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

function calculateCalendarAge(birthDate: Date, refDate: Date = new Date()): number {
  const bYear = birthDate.getUTCFullYear();
  const bMonth = birthDate.getUTCMonth();
  const bDay = birthDate.getUTCDate();

  const rYear = refDate.getUTCFullYear();
  const rMonth = refDate.getUTCMonth();
  const rDay = refDate.getUTCDate();

  let age = rYear - bYear;
  if (rMonth < bMonth || (rMonth === bMonth && rDay < bDay)) {
    age -= 1;
  }
  return Math.max(0, age);
}

@Injectable()
export class ExportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
  ) {}

  /**
   * Generates and streams export files (CSV/XLSX) for authorized leaders and officers.
   * Enforces server-side data scoping, hard 10,000 row limits, formula injection protection,
   * masked sensitive data, and cache prevention headers.
   */
  async exportData(
    currentUser: UserDto,
    dataset: ExportDataset,
    query: ExportQueryDto,
    res: Response,
  ): Promise<void> {
    // 1. Authorization check
    if (
      currentUser.role !== UserRole.LEADER &&
      currentUser.role !== UserRole.OFFICER
    ) {
      throw new AppException(
        'Chỉ Trưởng khu phố và Cán bộ phường mới có quyền xuất dữ liệu.',
        HttpStatus.FORBIDDEN,
        ErrorCode.FORBIDDEN,
      );
    }

    // 2. Validate Dataset
    if (!Object.values(ExportDataset).includes(dataset)) {
      throw new AppException(
        `Loại dữ liệu xuất không hợp lệ: "${dataset}".`,
        HttpStatus.BAD_REQUEST,
        ErrorCode.INVALID_EXPORT_DATASET,
      );
    }

    const format = query.format || ExportFormat.CSV;
    if (format !== ExportFormat.CSV && format !== ExportFormat.XLSX) {
      throw new AppException(
        `Định dạng xuất dữ liệu không hợp lệ: "${format}".`,
        HttpStatus.BAD_REQUEST,
        ErrorCode.INVALID_EXPORT_FORMAT,
      );
    }

    const dateSlug = new Date().toISOString().slice(0, 10);

    let columns: XlsxColumnDef[] = [];
    let rows: Record<string, unknown>[] = [];
    let filenameBase = '';
    let sheetName = '';

    switch (dataset) {
      case ExportDataset.RESIDENTS: {
        filenameBase = `danh-sach-nhan-khau-${dateSlug}`;
        sheetName = 'Danh sách nhân khẩu';
        const resData = await this.getResidentExportData(currentUser, query);
        columns = resData.columns;
        rows = resData.rows;
        break;
      }

      case ExportDataset.POLITICAL_SOCIAL: {
        filenameBase = `danh-sach-chinh-tri-xa-hoi-${dateSlug}`;
        sheetName = 'Chính trị xã hội';
        const polData = await this.getPoliticalSocialExportData(
          currentUser,
          query,
        );
        columns = polData.columns;
        rows = polData.rows;
        break;
      }

      case ExportDataset.ACTIVITIES: {
        const monthSlug = query.month || dateSlug.slice(0, 7);
        filenameBase = `so-tay-hoat-dong-${monthSlug}`;
        sheetName = 'Hoạt động khu phố';
        const actData = await this.getActivitiesExportData(currentUser, query);
        columns = actData.columns;
        rows = actData.rows;
        break;
      }

      case ExportDataset.PETITIONS: {
        filenameBase = `danh-sach-kien-nghi-${dateSlug}`;
        sheetName = 'Danh sách kiến nghị';
        const petData = await this.getPetitionsExportData(currentUser, query);
        columns = petData.columns;
        rows = petData.rows;
        break;
      }
    }

    const filename = `${filenameBase}.${format}`;
    const encodedFilename = encodeURIComponent(filename);

    // Set secure response headers
    res.setHeader(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, proxy-revalidate',
    );
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`,
    );

    if (format === ExportFormat.CSV) {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      const headers = columns.map((col) => col.header);
      const csvDataRows = rows.map((row) =>
        columns.map((col) => row[col.key] as string | number | null | undefined),
      );
      const csvContent = generateCsv(headers, csvDataRows);
      res.send(csvContent);
    } else {
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      const xlsxBuffer = await generateXlsx(sheetName, columns, rows);
      res.send(xlsxBuffer);
    }
  }

  /**
   * Fetches and formats resident profiles for export.
   */
  private async getResidentExportData(
    currentUser: UserDto,
    query: ExportQueryDto,
  ): Promise<{ columns: XlsxColumnDef[]; rows: Record<string, unknown>[] }> {
    const where = buildResidentWhereInput(
      currentUser,
      query,
      this.cryptoService,
    );

    const total = await this.prisma.residentProfile.count({ where });

    assertExportRowLimit(total);

    const profiles = await this.prisma.residentProfile.findMany({
      where,
      include: {
        household: true,
        neighborhood: true,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: MAX_EXPORT_ROWS + 1,
    });
    assertExportRowLimit(profiles.length);

    const columns: XlsxColumnDef[] = [
      { header: 'STT', key: 'stt', width: 8 },
      { header: 'Họ và tên', key: 'fullName', width: 26 },
      { header: 'Giới tính', key: 'gender', width: 14 },
      { header: 'Ngày sinh', key: 'birthDate', width: 16 },
      { header: 'Tuổi', key: 'age', width: 10 },
      { header: 'Số CCCD', key: 'maskedCitizenId', width: 18 },
      { header: 'Quan hệ với chủ hộ', key: 'relationshipToHead', width: 22 },
      { header: 'Số điện thoại', key: 'maskedPhone', width: 18 },
      { header: 'Email', key: 'maskedEmail', width: 24 },
      { header: 'Nghề nghiệp', key: 'occupation', width: 22 },
      { header: 'Địa chỉ thường trú', key: 'permanentAddress', width: 34 },
      { header: 'Địa chỉ hiện tại', key: 'currentAddress', width: 34 },
      { header: 'Mã hộ khẩu', key: 'householdCode', width: 16 },
      { header: 'Khu phố', key: 'neighborhoodName', width: 20 },
      { header: 'Phường/Xã', key: 'ward', width: 20 },
    ];

    const now = new Date();
    const rows = profiles.map((p, idx) => {
      let maskedCid = '***';
      try {
        if (p.citizenIdEncrypted) {
          const dec = this.cryptoService.decrypt(p.citizenIdEncrypted);
          maskedCid = maskCitizenId(dec);
        }
      } catch {
        maskedCid = '***';
      }

      let maskedPhone = '';
      try {
        if (p.phoneEncrypted) {
          const dec = this.cryptoService.decrypt(p.phoneEncrypted);
          maskedPhone = maskPhoneNumber(dec);
        }
      } catch {
        maskedPhone = '***';
      }

      let maskedEm = '';
      try {
        if (p.emailEncrypted) {
          const dec = this.cryptoService.decrypt(p.emailEncrypted);
          maskedEm = maskEmail(dec) ?? '';
        }
      } catch {
        maskedEm = '***';
      }

      const genderKey = (p.gender as unknown as Gender) || Gender.OTHER;
      const genderLabel = GENDER_LABELS[genderKey] || String(p.gender);

      return {
        stt: idx + 1,
        fullName: p.fullName,
        gender: genderLabel,
        birthDate: formatDate(p.birthDate),
        age: calculateCalendarAge(p.birthDate, now),
        maskedCitizenId: maskedCid,
        relationshipToHead: p.relationshipToHead || '',
        maskedPhone,
        maskedEmail: maskedEm,
        occupation: p.occupation || '',
        permanentAddress: p.permanentAddress || '',
        currentAddress: p.currentAddress || '',
        householdCode: p.household?.code || '',
        neighborhoodName: p.neighborhood?.name || '',
        ward: p.neighborhood?.ward || p.ward || '',
      };
    });

    return { columns, rows };
  }

  /**
   * Fetches and formats political-social profiles for export.
   */
  private async getPoliticalSocialExportData(
    currentUser: UserDto,
    query: ExportQueryDto,
  ): Promise<{ columns: XlsxColumnDef[]; rows: Record<string, unknown>[] }> {
    const where = buildResidentWhereInput(
      currentUser,
      query,
      this.cryptoService,
    );

    const total = await this.prisma.residentProfile.count({ where });

    assertExportRowLimit(total);

    const residents = await this.prisma.residentProfile.findMany({
      where,
      include: {
        household: true,
        neighborhood: true,
        politicalSocialProfile: true,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: MAX_EXPORT_ROWS + 1,
    });
    assertExportRowLimit(residents.length);

    const columns: XlsxColumnDef[] = [
      { header: 'STT', key: 'stt', width: 8 },
      { header: 'Họ và tên', key: 'fullName', width: 26 },
      { header: 'Giới tính', key: 'gender', width: 14 },
      { header: 'Ngày sinh', key: 'birthDate', width: 16 },
      { header: 'Tình trạng Đảng', key: 'partyStatus', width: 20 },
      { header: 'Ngày vào Đảng', key: 'partyAdmissionDate', width: 16 },
      { header: 'Trình độ học vấn', key: 'highestEducation', width: 26 },
      { header: 'Chuyên môn', key: 'specialty', width: 22 },
      { header: 'Nghề nghiệp chính thức', key: 'officialOccupation', width: 24 },
      { header: 'Sở trường', key: 'strengths', width: 26 },
      { header: 'Ghi chú', key: 'notes', width: 26 },
      { header: 'Mã hộ khẩu', key: 'householdCode', width: 16 },
      { header: 'Khu phố', key: 'neighborhoodName', width: 20 },
    ];

    const rows = residents.map((r, idx) => {
      const pol = r.politicalSocialProfile;
      const genderKey = (r.gender as unknown as Gender) || Gender.OTHER;
      const genderLabel = GENDER_LABELS[genderKey] || String(r.gender);

      let partyStatusLabel = 'Chưa cập nhật';
      if (pol?.partyStatus) {
        partyStatusLabel =
          PARTY_STATUS_LABELS[pol.partyStatus as unknown as PartyStatus] ||
          String(pol.partyStatus);
      }

      let educationLabel = 'Chưa cập nhật';
      if (pol?.highestEducation) {
        educationLabel =
          EDUCATION_LABELS[
            pol.highestEducation as unknown as HighestEducation
          ] || String(pol.highestEducation);
      }

      return {
        stt: idx + 1,
        fullName: r.fullName,
        gender: genderLabel,
        birthDate: formatDate(r.birthDate),
        partyStatus: partyStatusLabel,
        partyAdmissionDate: pol?.partyAdmissionDate
          ? formatDate(pol.partyAdmissionDate)
          : '',
        highestEducation: educationLabel,
        specialty: pol?.specialty || '',
        officialOccupation: pol?.officialOccupation || '',
        strengths: pol?.strengths || '',
        notes: pol?.notes || '',
        householdCode: r.household?.code || '',
        neighborhoodName: r.neighborhood?.name || '',
      };
    });

    return { columns, rows };
  }

  /**
   * Fetches and formats activities for export.
   */
  private async getActivitiesExportData(
    currentUser: UserDto,
    query: ExportQueryDto,
  ): Promise<{ columns: XlsxColumnDef[]; rows: Record<string, unknown>[] }> {
    const where: Prisma.NeighborhoodActivityWhereInput = {};

    // Scoping
    if (currentUser.role === UserRole.LEADER) {
      if (!currentUser.neighborhoodId) {
        throw new AppException(
          'Trưởng khu phố chưa được gán vào khu phố nào.',
          HttpStatus.FORBIDDEN,
          ErrorCode.FORBIDDEN,
        );
      }
      where.neighborhoodId = currentUser.neighborhoodId;
    } else if (currentUser.role === UserRole.OFFICER) {
      if (query.neighborhoodId && query.neighborhoodId.trim()) {
        where.neighborhoodId = query.neighborhoodId.trim();
      }
    }

    // Month filter
    if (query.month) {
      const [yStr, mStr] = query.month.split('-');
      const y = parseInt(yStr!, 10);
      const m = parseInt(mStr!, 10);
      if (!isNaN(y) && !isNaN(m) && m >= 1 && m <= 12) {
        const startOfMonth = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
        const endOfMonth = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
        where.activityDate = {
          gte: startOfMonth,
          lt: endOfMonth,
        };
      }
    }

    const total = await this.prisma.neighborhoodActivity.count({ where });

    assertExportRowLimit(total);

    const activities = await this.prisma.neighborhoodActivity.findMany({
      where,
      include: {
        neighborhood: { select: { name: true } },
        createdBy: { select: { fullName: true } },
        participants: { select: { attendance: true } },
      },
      orderBy: [{ activityDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      take: MAX_EXPORT_ROWS + 1,
    });
    assertExportRowLimit(activities.length);

    const columns: XlsxColumnDef[] = [
      { header: 'STT', key: 'stt', width: 8 },
      { header: 'Tên hoạt động', key: 'name', width: 28 },
      { header: 'Ngày diễn ra', key: 'activityDate', width: 16 },
      { header: 'Khu phố', key: 'neighborhoodName', width: 20 },
      { header: 'Người phụ trách', key: 'personInCharge', width: 22 },
      { header: 'Người tạo', key: 'createdByName', width: 22 },
      { header: 'Điều kiện trích xuất', key: 'filterCondition', width: 24 },
      { header: 'Tổng số tham gia', key: 'totalParticipants', width: 18 },
      { header: 'Có mặt', key: 'attendedCount', width: 14 },
      { header: 'Vắng mặt', key: 'absentCount', width: 14 },
      { header: 'Chưa điểm danh', key: 'unconfirmedCount', width: 16 },
      { header: 'Tỷ lệ tham gia', key: 'attendanceRate', width: 16 },
      { header: 'Mô tả nội dung', key: 'description', width: 34 },
      { header: 'Ngày tạo', key: 'createdAt', width: 18 },
    ];

    const rows = activities.map((a, idx) => {
      const parts = a.participants || [];
      const totalParticipants = parts.length;
      const attendedCount = parts.filter((p) => p.attendance === 'attended').length;
      const absentCount = parts.filter((p) => p.attendance === 'absent').length;
      const unconfirmedCount = parts.filter(
        (p) => p.attendance === 'unconfirmed',
      ).length;
      const attendanceRate =
        totalParticipants > 0
          ? `${Math.round((attendedCount / totalParticipants) * 100)}%`
          : '0%';

      const filterCond =
        (a.filterCondition as unknown as ActivityFilterCondition) ||
        ActivityFilterCondition.ALL;
      const filterConditionLabel =
        ACTIVITY_FILTER_LABELS[filterCond] || String(a.filterCondition);

      return {
        stt: idx + 1,
        name: a.name,
        activityDate: formatDate(a.activityDate),
        neighborhoodName: a.neighborhood?.name || '',
        personInCharge: a.personInCharge || '',
        createdByName: a.createdBy?.fullName || '',
        filterCondition: filterConditionLabel,
        totalParticipants,
        attendedCount,
        absentCount,
        unconfirmedCount,
        attendanceRate,
        description: a.description || '',
        createdAt: formatDateTime(a.createdAt),
      };
    });

    return { columns, rows };
  }

  /**
   * Fetches and formats petitions for export.
   */
  private async getPetitionsExportData(
    currentUser: UserDto,
    query: ExportQueryDto,
  ): Promise<{ columns: XlsxColumnDef[]; rows: Record<string, unknown>[] }> {
    const where: Prisma.PetitionWhereInput = {};

    // Scoping
    if (currentUser.role === UserRole.LEADER) {
      if (!currentUser.neighborhoodId) {
        throw new AppException(
          'Trưởng khu phố chưa được gán vào khu phố nào.',
          HttpStatus.FORBIDDEN,
          ErrorCode.FORBIDDEN,
        );
      }
      where.neighborhoodId = currentUser.neighborhoodId;
    } else if (currentUser.role === UserRole.OFFICER) {
      if (query.neighborhoodId && query.neighborhoodId.trim()) {
        where.neighborhoodId = query.neighborhoodId.trim();
      }
    }

    // Status filter
    if (query.status) {
      where.status = query.status as unknown as DbPetitionStatus;
    }

    // Category filter
    if (query.category) {
      where.category = query.category as unknown as DbPetitionCategory;
    }

    // Date range filter
    if (query.startDate || query.endDate) {
      const dateFilter: Prisma.DateTimeFilter = {};
      if (query.startDate) {
        dateFilter.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setUTCHours(23, 59, 59, 999);
        dateFilter.lte = end;
      }
      where.createdAt = dateFilter;
    }

    // Search filter
    if (query.search && query.search.trim().length > 0) {
      const trimmedSearch = query.search.trim();
      where.OR = [
        { title: { contains: trimmedSearch, mode: 'insensitive' } },
        { description: { contains: trimmedSearch, mode: 'insensitive' } },
        { author: { fullName: { contains: trimmedSearch, mode: 'insensitive' } } },
      ];
    }

    const total = await this.prisma.petition.count({ where });

    assertExportRowLimit(total);

    const petitions = await this.prisma.petition.findMany({
      where,
      include: {
        neighborhood: { select: { name: true } },
        author: { select: { fullName: true, phoneEncrypted: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: MAX_EXPORT_ROWS + 1,
    });
    assertExportRowLimit(petitions.length);

    const columns: XlsxColumnDef[] = [
      { header: 'STT', key: 'stt', width: 8 },
      { header: 'Tiêu đề kiến nghị', key: 'title', width: 28 },
      { header: 'Danh mục', key: 'category', width: 20 },
      { header: 'Trạng thái', key: 'status', width: 18 },
      { header: 'Người gửi', key: 'authorName', width: 22 },
      { header: 'Số điện thoại', key: 'authorPhone', width: 18 },
      { header: 'Khu phố', key: 'neighborhoodName', width: 20 },
      { header: 'Nội dung kiến nghị', key: 'description', width: 36 },
      { header: 'Phản hồi xử lý', key: 'responseNote', width: 30 },
      { header: 'Ngày gửi', key: 'createdAt', width: 18 },
      { header: 'Ngày cập nhật', key: 'updatedAt', width: 18 },
    ];

    const rows = petitions.map((p, idx) => {
      let maskedPhone = '';
      try {
        if (p.author?.phoneEncrypted) {
          const dec = this.cryptoService.decrypt(p.author.phoneEncrypted);
          maskedPhone = maskPhoneNumber(dec);
        }
      } catch {
        maskedPhone = '***';
      }

      const catKey =
        (p.category as unknown as PetitionCategory) || PetitionCategory.OTHER;
      const catLabel = PETITION_CATEGORY_LABELS[catKey] || String(p.category);

      const statusKey =
        (p.status as unknown as PetitionStatus) || PetitionStatus.REVIEWING;
      const statusLabel =
        PETITION_STATUS_LABELS[statusKey] || String(p.status);

      return {
        stt: idx + 1,
        title: p.title,
        category: catLabel,
        status: statusLabel,
        authorName: p.author?.fullName || '',
        authorPhone: maskedPhone,
        neighborhoodName: p.neighborhood?.name || '',
        description: p.description,
        responseNote: p.responseNote || '',
        createdAt: formatDateTime(p.createdAt),
        updatedAt: formatDateTime(p.updatedAt),
      };
    });

    return { columns, rows };
  }
}
