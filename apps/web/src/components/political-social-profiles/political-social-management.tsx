'use client';

import React, { useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Modal,
  Select,
} from '@quanlykhupho/ui';
import {
  Gender,
  ExportDataset,
  HighestEducation,
  PartyStatus,
  ResidentPoliticalSocialItemDto,
  UpsertPoliticalSocialProfileDto,
  UserDto,
  UserRole,
} from '@quanlykhupho/shared-types';
import { useNeighborhoods } from '../../hooks/use-neighborhoods';
import {
  usePoliticalSocialProfiles,
  useUpsertPoliticalSocialProfile,
} from '../../hooks/use-political-social-profiles';
import { getErrorMessage } from '../../lib/api-client';
import { ExportModal } from '../exports/export-modal';
import { AppIcon } from '../app-icon';

interface PoliticalSocialManagementProps {
  user: UserDto;
}

interface PoliticalSocialFormState
  extends Omit<UpsertPoliticalSocialProfileDto, 'partyStatus'> {
  partyStatus: PartyStatus | '';
}

export const PARTY_STATUS_LABELS: Record<PartyStatus, string> = {
  [PartyStatus.PARTY_MEMBER]: 'Đảng viên',
  [PartyStatus.UNDER_CONSIDERATION]: 'Đang xem xét',
  [PartyStatus.NOT_MEMBER]: 'Chưa vào Đảng',
};

export const EDUCATION_LABELS: Record<HighestEducation, string> = {
  [HighestEducation.LOWER_SECONDARY]: 'Trung học cơ sở (THCS)',
  [HighestEducation.UPPER_SECONDARY]: 'Trung học phổ thông (THPT)',
  [HighestEducation.VOCATIONAL]: 'Trung cấp nghề / Sơ cấp',
  [HighestEducation.COLLEGE]: 'Cao đẳng',
  [HighestEducation.BACHELOR]: 'Đại học / Cử nhân',
  [HighestEducation.MASTER]: 'Thạc sĩ',
  [HighestEducation.DOCTORATE]: 'Tiến sĩ',
};

const GENDER_LABELS: Record<Gender, string> = {
  [Gender.MALE]: 'Nam',
  [Gender.FEMALE]: 'Nữ',
  [Gender.OTHER]: 'Khác',
};

export function PoliticalSocialManagement({ user }: PoliticalSocialManagementProps) {
  const isOfficer = user.role === UserRole.OFFICER;

  // Filter & Pagination state
  const [selectedNeighborhoodId, setSelectedNeighborhoodId] = useState<string>('');
  const [selectedPartyStatus, setSelectedPartyStatus] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeSearch, setActiveSearch] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);

  // Queries
  const { data: neighborhoods = [] } = useNeighborhoods();
  const effectiveNeighborhoodId = isOfficer
    ? selectedNeighborhoodId || undefined
    : user.neighborhoodId || undefined;

  const {
    data: listData,
    isLoading,
    isError,
    error,
    refetch,
  } = usePoliticalSocialProfiles({
    neighborhoodId: effectiveNeighborhoodId,
    partyStatus: (selectedPartyStatus as PartyStatus | 'not_updated') || undefined,
    search: activeSearch || undefined,
    page: currentPage,
    limit: 10,
  });

  const upsertMutation = useUpsertPoliticalSocialProfile();

  // Modal State
  const [editingResident, setEditingResident] = useState<ResidentPoliticalSocialItemDto | null>(null);
  const [formState, setFormState] = useState<PoliticalSocialFormState>({
    partyStatus: '',
    partyAdmissionDate: '',
    highestEducation: null,
    specialty: '',
    officialOccupation: '',
    strengths: '',
    notes: '',
  });
  const [formError, setFormError] = useState<string | null>(null);

  // Toast feedback
  const [toastFeedback, setToastFeedback] = useState<{
    variant: 'success' | 'error';
    message: string;
  } | null>(null);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveSearch(searchQuery.trim());
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setActiveSearch('');
    setSelectedPartyStatus('');
    if (isOfficer) setSelectedNeighborhoodId('');
    setCurrentPage(1);
  };

  const handleOpenEditModal = (item: ResidentPoliticalSocialItemDto) => {
    setEditingResident(item);
    const existing = item.politicalSocialProfile;
    setFormState({
      partyStatus: existing?.partyStatus || '',
      partyAdmissionDate: existing?.partyAdmissionDate
        ? existing.partyAdmissionDate.slice(0, 10)
        : '',
      highestEducation: existing?.highestEducation || null,
      specialty: existing?.specialty || '',
      officialOccupation: existing?.officialOccupation || '',
      strengths: existing?.strengths || '',
      notes: existing?.notes || '',
    });
    setFormError(null);
  };

  const handleCloseModal = () => {
    setEditingResident(null);
    setFormError(null);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingResident) return;
    setFormError(null);

    // Client-side validations
    if (!formState.partyStatus) {
      setFormError('Vui lòng chọn tình trạng Đảng.');
      return;
    }

    if (formState.partyStatus === PartyStatus.PARTY_MEMBER) {
      if (!formState.partyAdmissionDate) {
        setFormError('Ngày vào Đảng là bắt buộc đối với Đảng viên.');
        return;
      }
      const admissionDate = new Date(formState.partyAdmissionDate);
      if (isNaN(admissionDate.getTime())) {
        setFormError('Ngày vào Đảng không đúng định dạng ngày tháng hợp lệ.');
        return;
      }
      const now = new Date();
      if (admissionDate > now) {
        setFormError('Ngày vào Đảng không được ở tương lai.');
        return;
      }
      const birthDate = new Date(editingResident.birthDate);
      if (admissionDate < birthDate) {
        setFormError('Ngày vào Đảng không được trước ngày sinh của cư dân.');
        return;
      }
    }

    if (formState.specialty && formState.specialty.trim().length > 255) {
      setFormError('Chuyên môn / Chuyên ngành tối đa 255 ký tự.');
      return;
    }

    if (formState.officialOccupation && formState.officialOccupation.trim().length > 255) {
      setFormError('Nghề nghiệp / Vị trí công tác tối đa 255 ký tự.');
      return;
    }

    if (formState.strengths && formState.strengths.trim().length > 1000) {
      setFormError('Sở trường / Kỹ năng nổi bật tối đa 1000 ký tự.');
      return;
    }

    if (formState.notes && formState.notes.trim().length > 4000) {
      setFormError('Ghi chú tối đa 4000 ký tự.');
      return;
    }

    try {
      await upsertMutation.mutateAsync({
        residentProfileId: editingResident.id,
        dto: {
          partyStatus: formState.partyStatus,
          partyAdmissionDate:
            formState.partyStatus === PartyStatus.PARTY_MEMBER
              ? formState.partyAdmissionDate
              : null,
          highestEducation: formState.highestEducation || null,
          specialty: formState.specialty?.trim() || null,
          officialOccupation: formState.officialOccupation?.trim() || null,
          strengths: formState.strengths?.trim() || null,
          notes: formState.notes?.trim() || null,
        },
      });

      setToastFeedback({
        variant: 'success',
        message: `Đã cập nhật thông tin chính trị - xã hội cho cư dân "${editingResident.fullName}" thành công.`,
      });
      handleCloseModal();
    } catch (err) {
      setFormError(getErrorMessage(err));
    }
  };

  const items = listData?.items || [];
  const total = listData?.total || 0;
  const totalPages = listData?.totalPages || 1;

  const renderPartyStatusBadge = (item: ResidentPoliticalSocialItemDto) => {
    if (!item.politicalSocialProfile) {
      return (
        <Badge variant="outline" className="border-dashed border-slate-300 text-slate-500">
          Chưa cập nhật
        </Badge>
      );
    }
    const status = item.politicalSocialProfile.partyStatus;
    switch (status) {
      case PartyStatus.PARTY_MEMBER:
        return <Badge variant="destructive">Đảng viên</Badge>;
      case PartyStatus.UNDER_CONSIDERATION:
        return <Badge variant="warning">Đang xem xét</Badge>;
      case PartyStatus.NOT_MEMBER:
      default:
        return <Badge variant="default">Chưa vào Đảng</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {toastFeedback && (
        <Alert
          variant={toastFeedback.variant}
          message={toastFeedback.message}
          onClose={() => setToastFeedback(null)}
        />
      )}

      {/* Main Card */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle>Thông tin Chính trị - Xã hội Cư dân</CardTitle>
                <Badge variant="info">{total} hồ sơ</Badge>
              </div>
              <CardDescription>
                {isOfficer
                  ? 'Tra cứu và quản lý thông tin chính trị, đoàn thể và học vấn của cư dân toàn phường'
                  : `Hồ sơ chính trị, đoàn thể và trình độ học vấn của cư dân thuộc ${user.neighborhood?.name || 'Khu phố'}`}
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="md"
                onClick={() => setIsExportModalOpen(true)}
                className="text-xs sm:text-sm"
              >
                <AppIcon name="download" className="h-4 w-4 mr-1.5 inline" />
                Xuất dữ liệu
              </Button>
              <Button
                variant="outline"
                size="md"
                onClick={() => refetch()}
                className="text-xs sm:text-sm"
              >
                Làm mới
              </Button>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <form
              onSubmit={handleSearchSubmit}
              className="flex flex-1 items-center gap-2 max-w-lg"
            >
              <Input
                placeholder="Tìm theo họ tên cư dân, mã hộ khẩu..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-xs"
              />
              <Button
                type="submit"
                variant="secondary"
                size="md"
                className="text-xs shrink-0"
              >
                Tìm kiếm
              </Button>
            </form>

            <div className="flex flex-wrap items-center gap-2">
              {isOfficer && (
                <select
                  aria-label="Lọc theo khu phố"
                  value={selectedNeighborhoodId}
                  onChange={(e) => {
                    setSelectedNeighborhoodId(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm focus:border-blue-600 focus:outline-none"
                >
                  <option value="">Tất cả khu phố</option>
                  {neighborhoods.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name}
                    </option>
                  ))}
                </select>
              )}

              <select
                aria-label="Lọc theo tình trạng Đảng"
                value={selectedPartyStatus}
                onChange={(e) => {
                  setSelectedPartyStatus(e.target.value);
                  setCurrentPage(1);
                }}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm focus:border-blue-600 focus:outline-none"
              >
                <option value="">Tất cả tình trạng Đảng</option>
                <option value={PartyStatus.PARTY_MEMBER}>Đảng viên</option>
                <option value={PartyStatus.UNDER_CONSIDERATION}>
                  Đoàn viên / Đối tượng Đảng
                </option>
                <option value={PartyStatus.NOT_MEMBER}>Chưa vào Đảng</option>
                <option value="not_updated">Chưa cập nhật</option>
              </select>

              {(activeSearch || selectedPartyStatus || selectedNeighborhoodId) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetFilters}
                  className="text-xs text-slate-500 hover:text-slate-700"
                >
                  Xóa lọc
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-slate-500">
              <svg
                className="animate-spin h-6 w-6 mr-2 text-blue-600"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Đang tải danh sách hồ sơ...
            </div>
          ) : isError ? (
            <Alert
              variant="error"
              message={
                getErrorMessage(error) ||
                'Không thể tải danh sách thông tin chính trị - xã hội.'
              }
            />
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-12 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <AppIcon name="flag" className="h-6 w-6" />
              </div>
              <h4 className="mt-3 text-base font-bold text-slate-900">
                Không tìm thấy hồ sơ cư dân nào
              </h4>
              <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
                {activeSearch || selectedPartyStatus || selectedNeighborhoodId
                  ? 'Không tìm thấy hồ sơ phù hợp với bộ lọc. Vui lòng thử lại với từ khóa khác.'
                  : 'Chưa có dữ liệu cư dân trong phạm vi quản lý.'}
              </p>
            </div>
          ) : (
            <div>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Họ và tên</th>
                      <th className="px-4 py-3">Mã hộ</th>
                      <th className="px-4 py-3">Tình trạng Đảng</th>
                      <th className="px-4 py-3">Ngày vào Đảng</th>
                      <th className="px-4 py-3">Trình độ học vấn</th>
                      <th className="px-4 py-3">Chuyên môn / Nghề nghiệp</th>
                      {isOfficer && <th className="px-4 py-3">Khu phố</th>}
                      <th className="px-4 py-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item) => (
                      <tr
                        key={item.id}
                        className="hover:bg-slate-50/80 transition"
                      >
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          <div>{item.fullName}</div>
                          <div className="text-[11px] text-slate-400 font-normal">
                            {new Date(item.birthDate).toLocaleDateString('vi-VN')}{' '}
                            • {GENDER_LABELS[item.gender] || item.gender}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {item.householdCode || 'Chưa có'}
                        </td>
                        <td className="px-4 py-3">
                          {renderPartyStatusBadge(item)}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {item.politicalSocialProfile?.partyAdmissionDate
                            ? new Date(
                                item.politicalSocialProfile.partyAdmissionDate,
                              ).toLocaleDateString('vi-VN')
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-800">
                          {item.politicalSocialProfile?.highestEducation
                            ? EDUCATION_LABELS[
                                item.politicalSocialProfile.highestEducation
                              ] || item.politicalSocialProfile.highestEducation
                            : '—'}
                        </td>
                        <td className="px-4 py-3 max-w-xs truncate text-slate-600">
                          {item.politicalSocialProfile?.specialty ||
                          item.politicalSocialProfile?.officialOccupation ? (
                            <span>
                              {item.politicalSocialProfile?.specialty && (
                                <span className="font-medium text-slate-800">
                                  {item.politicalSocialProfile.specialty}
                                </span>
                              )}
                              {item.politicalSocialProfile?.specialty &&
                                item.politicalSocialProfile?.officialOccupation &&
                                ' / '}
                              {item.politicalSocialProfile?.officialOccupation}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        {isOfficer && (
                          <td className="px-4 py-3">
                            <Badge variant="info">
                              {item.neighborhoodName || 'Khu phố'}
                            </Badge>
                          </td>
                        )}
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenEditModal(item)}
                            className="text-xs"
                          >
                            {item.politicalSocialProfile ? 'Cập nhật' : 'Thiết lập'}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards View */}
              <div className="md:hidden space-y-3">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-slate-900">
                        {item.fullName}
                      </h4>
                      {renderPartyStatusBadge(item)}
                    </div>

                    <p className="text-slate-600">
                      <strong>Hộ khẩu:</strong> {item.householdCode || 'Chưa có'} •{' '}
                      <strong>Ngày sinh:</strong>{' '}
                      {new Date(item.birthDate).toLocaleDateString('vi-VN')}
                    </p>

                    {item.politicalSocialProfile?.partyAdmissionDate && (
                      <p className="text-slate-600">
                        <strong>Ngày vào Đảng:</strong>{' '}
                        {new Date(
                          item.politicalSocialProfile.partyAdmissionDate,
                        ).toLocaleDateString('vi-VN')}
                      </p>
                    )}

                    {item.politicalSocialProfile?.highestEducation && (
                      <p className="text-slate-600">
                        <strong>Học vấn:</strong>{' '}
                        {EDUCATION_LABELS[
                          item.politicalSocialProfile.highestEducation
                        ] || item.politicalSocialProfile.highestEducation}
                      </p>
                    )}

                    {(item.politicalSocialProfile?.specialty ||
                      item.politicalSocialProfile?.officialOccupation) && (
                      <p className="text-slate-600">
                        <strong>Chuyên môn / Nghề nghiệp:</strong>{' '}
                        {[
                          item.politicalSocialProfile.specialty,
                          item.politicalSocialProfile.officialOccupation,
                        ]
                          .filter(Boolean)
                          .join(' — ')}
                      </p>
                    )}

                    {isOfficer && item.neighborhoodName && (
                      <p className="text-slate-600">
                        <strong>Khu phố:</strong> {item.neighborhoodName}
                      </p>
                    )}

                    <div className="pt-2 border-t border-slate-200 flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenEditModal(item)}
                        className="w-full text-xs"
                      >
                        {item.politicalSocialProfile
                          ? 'Cập nhật thông tin'
                          : 'Thiết lập thông tin'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-600">
                  <div>
                    Trang <strong>{currentPage}</strong> /{' '}
                    <strong>{totalPages}</strong> (Tổng cộng {total} hồ sơ)
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage <= 1}
                      className="text-xs"
                    >
                      Trước
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={currentPage >= totalPages}
                      className="text-xs"
                    >
                      Sau
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit / Upsert Modal */}
      <Modal
        isOpen={Boolean(editingResident)}
        onClose={handleCloseModal}
        title="Cập nhật Thông tin Chính trị - Xã hội"
        description={
          editingResident
            ? `Cư dân: ${editingResident.fullName} (Mã hộ: ${editingResident.householdCode || 'Chưa có'})`
            : ''
        }
        maxWidth="lg"
      >
        <form onSubmit={handleFormSubmit} className="space-y-4 text-xs">
          {formError && (
            <Alert
              variant="error"
              message={formError}
              onClose={() => setFormError(null)}
            />
          )}

          {/* Party Status Section */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <h4 className="font-bold text-slate-800 text-xs">
              Thông tin Đảng & Đoàn thể
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select
                label="Tình trạng Đảng"
                value={formState.partyStatus}
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    partyStatus: e.target.value as PartyStatus,
                  })
                }
                options={[
                  {
                    value: '',
                    label: '-- Chọn tình trạng Đảng --',
                  },
                  {
                    value: PartyStatus.NOT_MEMBER,
                    label: 'Chưa vào Đảng (Quần chúng)',
                  },
                  {
                    value: PartyStatus.UNDER_CONSIDERATION,
                    label: 'Đang xem xét',
                  },
                  {
                    value: PartyStatus.PARTY_MEMBER,
                    label: 'Đảng viên',
                  },
                ]}
                required
              />

              {formState.partyStatus === PartyStatus.PARTY_MEMBER ? (
                <Input
                  label="Ngày vào Đảng"
                  type="date"
                  value={formState.partyAdmissionDate || ''}
                  onChange={(e) =>
                    setFormState({
                      ...formState,
                      partyAdmissionDate: e.target.value,
                    })
                  }
                  required
                  helperText="Bắt buộc đối với Đảng viên, không được ở tương lai"
                />
              ) : (
                <div className="flex flex-col justify-center text-[11px] text-slate-400 pt-2">
                  <span>* Ngày vào Đảng chỉ áp dụng khi tình trạng là Đảng viên.</span>
                </div>
              )}
            </div>
          </div>

          {/* Education & Occupation */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <h4 className="font-bold text-slate-800 text-xs">
              Trình độ học vấn & Chuyên môn
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select
                label="Trình độ học vấn cao nhất"
                value={formState.highestEducation || ''}
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    highestEducation: (e.target.value as HighestEducation) || null,
                  })
                }
                options={[
                  { value: '', label: '-- Chọn trình độ học vấn --' },
                  {
                    value: HighestEducation.LOWER_SECONDARY,
                    label: 'Trung học cơ sở (THCS)',
                  },
                  {
                    value: HighestEducation.UPPER_SECONDARY,
                    label: 'Trung học phổ thông (THPT)',
                  },
                  {
                    value: HighestEducation.VOCATIONAL,
                    label: 'Trung cấp nghề / Sơ cấp',
                  },
                  {
                    value: HighestEducation.COLLEGE,
                    label: 'Cao đẳng',
                  },
                  {
                    value: HighestEducation.BACHELOR,
                    label: 'Đại học / Cử nhân',
                  },
                  {
                    value: HighestEducation.MASTER,
                    label: 'Thạc sĩ',
                  },
                  {
                    value: HighestEducation.DOCTORATE,
                    label: 'Tiến sĩ',
                  },
                ]}
              />

              <Input
                label="Chuyên môn / Chuyên ngành đào tạo"
                placeholder="Ví dụ: Công nghệ thông tin, Sư phạm..."
                value={formState.specialty || ''}
                onChange={(e) =>
                  setFormState({ ...formState, specialty: e.target.value })
                }
                helperText="Tối đa 255 ký tự"
              />
            </div>

            <Input
              label="Nghề nghiệp / Vị trí công tác chính thức"
              placeholder="Ví dụ: Giáo viên, Chuyên viên, Kỹ sư trưởng..."
              value={formState.officialOccupation || ''}
              onChange={(e) =>
                setFormState({
                  ...formState,
                  officialOccupation: e.target.value,
                })
              }
              helperText="Tối đa 255 ký tự"
            />
          </div>

          {/* Strengths & Notes */}
          <div className="space-y-3">
            <div>
              <label
                htmlFor="political-social-strengths"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Sở trường / Kỹ năng nổi bật
              </label>
              <textarea
                id="political-social-strengths"
                className="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900 transition-colors focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-1"
                rows={2}
                placeholder="Ví dụ: Tuyên truyền vận động, phong trào thanh niên, văn hóa văn nghệ..."
                value={formState.strengths || ''}
                onChange={(e) =>
                  setFormState({ ...formState, strengths: e.target.value })
                }
                maxLength={1000}
              />
              <p className="mt-1 text-[11px] text-slate-400">Tối đa 1000 ký tự</p>
            </div>

            <div>
              <label
                htmlFor="political-social-notes"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Ghi chú bổ sung
              </label>
              <textarea
                id="political-social-notes"
                className="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900 transition-colors focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-1"
                rows={3}
                placeholder="Ghi chú về quá trình công tác, sinh hoạt chi bộ, đoàn thể..."
                value={formState.notes || ''}
                onChange={(e) =>
                  setFormState({ ...formState, notes: e.target.value })
                }
                maxLength={4000}
              />
              <p className="mt-1 text-[11px] text-slate-400">Tối đa 4000 ký tự</p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={handleCloseModal}
              disabled={upsertMutation.isPending}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={upsertMutation.isPending}
            >
              Lưu thông tin
            </Button>
          </div>
        </form>
      </Modal>

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        dataset={ExportDataset.POLITICAL_SOCIAL}
        title="Xuất thông tin Chính trị - Xã hội"
        description="Xuất toàn bộ hồ sơ chính trị - xã hội khớp bộ lọc hiện tại."
        filters={{
          neighborhoodId: effectiveNeighborhoodId,
          partyStatus:
            (selectedPartyStatus as PartyStatus | 'not_updated') || undefined,
          search: activeSearch || undefined,
        }}
        filterSummary={[
          ...(activeSearch ? [{ label: 'Từ khóa', value: activeSearch }] : []),
          ...(selectedPartyStatus
            ? [{ label: 'Tình trạng Đảng', value: selectedPartyStatus }]
            : []),
        ]}
      />
    </div>
  );
}
