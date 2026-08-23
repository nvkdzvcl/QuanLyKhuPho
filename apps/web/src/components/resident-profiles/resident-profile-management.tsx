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
  CreateResidentProfileDto,
  Gender,
  ResidentProfileDetailDto,
  ResidentProfileDto,
  UpdateResidentProfileDto,
  UserDto,
  UserRole,
} from '@quanlykhupho/shared-types';
import { useNeighborhoods } from '../../hooks/use-neighborhoods';
import {
  useCreateResidentProfile,
  useResidentProfile,
  useResidentProfiles,
  useUpdateResidentProfile,
} from '../../hooks/use-resident-profiles';
import { getErrorMessage } from '../../lib/api-client';

interface ResidentProfileManagementProps {
  user: UserDto;
}

const GENDER_LABELS: Record<Gender, string> = {
  [Gender.MALE]: 'Nam',
  [Gender.FEMALE]: 'Nữ',
  [Gender.OTHER]: 'Khác',
};

const RELATIONSHIP_OPTIONS = [
  { value: 'Chủ hộ', label: 'Chủ hộ' },
  { value: 'Vợ', label: 'Vợ' },
  { value: 'Chồng', label: 'Chồng' },
  { value: 'Con', label: 'Con' },
  { value: 'Bố/Mẹ', label: 'Bố/Mẹ' },
  { value: 'Ông/Bà', label: 'Ông/Bà' },
  { value: 'Cháu', label: 'Cháu' },
  { value: 'Anh/Chị/Em', label: 'Anh/Chị/Em' },
  { value: 'Khác', label: 'Khác' },
];

export function ResidentProfileManagement({
  user,
}: ResidentProfileManagementProps) {
  const isOfficer = user.role === UserRole.OFFICER;

  // Filter and pagination state
  const [selectedNeighborhoodId, setSelectedNeighborhoodId] =
    useState<string>('');
  const [selectedGender, setSelectedGender] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeSearch, setActiveSearch] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Queries
  const { data: neighborhoods = [] } = useNeighborhoods();
  const effectiveNeighborhoodId = isOfficer
    ? selectedNeighborhoodId || undefined
    : user.neighborhoodId || undefined;

  const {
    data: profilesData,
    isLoading,
    isError,
    error,
    refetch,
  } = useResidentProfiles({
    neighborhoodId: effectiveNeighborhoodId,
    gender: (selectedGender as Gender) || undefined,
    search: activeSearch || undefined,
    page: currentPage,
    limit: 10,
  });

  const createMutation = useCreateResidentProfile();
  const updateMutation = useUpdateResidentProfile();

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    null,
  );
  const [isEditMode, setIsEditMode] = useState(false);

  // Create Form State
  const [createForm, setCreateForm] = useState<CreateResidentProfileDto>({
    fullName: '',
    citizenId: '',
    citizenIdIssueDate: '',
    birthDate: '',
    gender: Gender.MALE,
    placeOfBirth: '',
    relationshipToHead: 'Chủ hộ',
    phoneNumber: '',
    email: '',
    occupation: '',
    permanentAddress: '',
    currentAddress: '',
    householdCode: '',
    neighborhoodId: isOfficer ? '' : user.neighborhoodId || undefined,
  });
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit Form State
  const [editForm, setEditForm] = useState<UpdateResidentProfileDto>({});
  const [editError, setEditError] = useState<string | null>(null);

  // Toast feedback state
  const [toastFeedback, setToastFeedback] = useState<{
    variant: 'success' | 'error';
    message: string;
  } | null>(null);

  // Detail query for active selected profile
  const {
    data: profileDetail,
    isLoading: isLoadingDetail,
    refetch: refetchDetail,
  } = useResidentProfile(selectedProfileId);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveSearch(searchQuery.trim());
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setActiveSearch('');
    setSelectedGender('');
    if (isOfficer) setSelectedNeighborhoodId('');
    setCurrentPage(1);
  };

  const handleOpenCreateModal = () => {
    setCreateForm({
      fullName: '',
      citizenId: '',
      citizenIdIssueDate: '',
      birthDate: '',
      gender: Gender.MALE,
      placeOfBirth: '',
      relationshipToHead: 'Chủ hộ',
      phoneNumber: '',
      email: '',
      occupation: '',
      permanentAddress: '',
      currentAddress: '',
      householdCode: '',
      neighborhoodId: isOfficer
        ? selectedNeighborhoodId || ''
        : user.neighborhoodId || undefined,
    });
    setCreateError(null);
    setIsCreateModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    // Client-side validations
    if (!createForm.fullName.trim()) {
      setCreateError('Vui lòng nhập họ và tên cư dân.');
      return;
    }
    const cleanCid = createForm.citizenId.trim().replace(/[\s-]/g, '');
    if (!/^\d{12}$/.test(cleanCid)) {
      setCreateError('Số Căn cước công dân phải bao gồm đúng 12 chữ số.');
      return;
    }
    if (!createForm.birthDate) {
      setCreateError('Vui lòng chọn ngày sinh.');
      return;
    }
    const now = new Date();
    if (new Date(createForm.birthDate) > now) {
      setCreateError('Ngày sinh không được ở tương lai.');
      return;
    }
    if (
      createForm.citizenIdIssueDate &&
      new Date(createForm.citizenIdIssueDate) > now
    ) {
      setCreateError('Ngày cấp CCCD không được ở tương lai.');
      return;
    }
    if (!createForm.householdCode.trim()) {
      setCreateError('Vui lòng nhập mã số hộ khẩu.');
      return;
    }
    if (!createForm.permanentAddress.trim()) {
      setCreateError('Vui lòng nhập địa chỉ thường trú.');
      return;
    }
    if (isOfficer && !createForm.neighborhoodId) {
      setCreateError('Vui lòng chọn khu phố trực thuộc.');
      return;
    }

    try {
      const created = await createMutation.mutateAsync({
        ...createForm,
        citizenId: cleanCid,
        citizenIdIssueDate: createForm.citizenIdIssueDate || undefined,
        phoneNumber: createForm.phoneNumber?.trim() || undefined,
        email: createForm.email?.trim() || undefined,
        currentAddress: createForm.currentAddress?.trim() || undefined,
        placeOfBirth: createForm.placeOfBirth?.trim() || undefined,
        occupation: createForm.occupation?.trim() || undefined,
      });

      setToastFeedback({
        variant: 'success',
        message: `Đã thêm hồ sơ nhân khẩu "${created.fullName}" (Hộ khẩu: ${created.household?.code}) thành công.`,
      });
      setIsCreateModalOpen(false);
    } catch (err) {
      setCreateError(getErrorMessage(err));
    }
  };

  const handleOpenDetail = (profile: ResidentProfileDto) => {
    setSelectedProfileId(profile.id);
    setIsEditMode(false);
    setEditError(null);
  };

  const handleStartEdit = (detail: ResidentProfileDetailDto) => {
    setEditForm({
      fullName: detail.fullName,
      citizenId: detail.citizenId,
      citizenIdIssueDate: detail.citizenIdIssueDate
        ? detail.citizenIdIssueDate.slice(0, 10)
        : '',
      birthDate: detail.birthDate ? detail.birthDate.slice(0, 10) : '',
      gender: detail.gender,
      placeOfBirth: detail.placeOfBirth || '',
      relationshipToHead: detail.relationshipToHead || '',
      phoneNumber: detail.phoneNumber || '',
      email: detail.email || '',
      occupation: detail.occupation || '',
      permanentAddress: detail.permanentAddress,
      currentAddress: detail.currentAddress || '',
      householdCode: detail.household?.code || '',
      neighborhoodId: detail.neighborhoodId,
    });
    setIsEditMode(true);
    setEditError(null);
  };

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProfileId) return;
    setEditError(null);

    if (editForm.fullName && !editForm.fullName.trim()) {
      setEditError('Họ và tên không được để trống.');
      return;
    }
    if (editForm.citizenId) {
      const cleanCid = editForm.citizenId.trim().replace(/[\s-]/g, '');
      if (!/^\d{12}$/.test(cleanCid)) {
        setEditError('Số Căn cước công dân phải bao gồm đúng 12 chữ số.');
        return;
      }
    }
    if (editForm.birthDate && new Date(editForm.birthDate) > new Date()) {
      setEditError('Ngày sinh không được ở tương lai.');
      return;
    }
    if (
      editForm.citizenIdIssueDate &&
      new Date(editForm.citizenIdIssueDate) > new Date()
    ) {
      setEditError('Ngày cấp CCCD không được ở tương lai.');
      return;
    }

    try {
      const updated = await updateMutation.mutateAsync({
        id: selectedProfileId,
        dto: {
          ...editForm,
          citizenId: editForm.citizenId
            ? editForm.citizenId.trim().replace(/[\s-]/g, '')
            : undefined,
          citizenIdIssueDate: editForm.citizenIdIssueDate || null,
          phoneNumber: editForm.phoneNumber?.trim() || null,
          email: editForm.email?.trim() || null,
          currentAddress: editForm.currentAddress?.trim() || null,
          placeOfBirth: editForm.placeOfBirth?.trim() || null,
          occupation: editForm.occupation?.trim() || null,
        },
      });

      setToastFeedback({
        variant: 'success',
        message: `Đã cập nhật hồ sơ nhân khẩu "${updated.fullName}" thành công.`,
      });
      setIsEditMode(false);
      refetchDetail();
    } catch (err) {
      setEditError(getErrorMessage(err));
    }
  };

  const items = profilesData?.items || [];
  const total = profilesData?.total || 0;
  const totalPages = profilesData?.totalPages || 1;

  const neighborhoodOptions = neighborhoods.map((n) => ({
    value: n.id,
    label: `${n.name} (${n.code}) - ${n.ward}`,
  }));

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
                <CardTitle>Quản lý Hồ sơ Nhân khẩu</CardTitle>
                <Badge variant="info">{total} nhân khẩu</Badge>
              </div>
              <CardDescription>
                {isOfficer
                  ? 'Tra cứu, lập hồ sơ và quản lý nhân khẩu trên toàn địa bàn phường'
                  : `Danh sách và quản lý hồ sơ nhân khẩu thuộc ${user.neighborhood?.name || 'Khu phố'}`}
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                size="md"
                onClick={handleOpenCreateModal}
                className="shadow-sm text-xs sm:text-sm font-semibold"
              >
                + Thêm mới nhân khẩu
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
                placeholder="Tìm theo họ tên, mã hộ khẩu, số CCCD (12 số)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-xs"
              />
              <Button type="submit" variant="secondary" size="md" className="text-xs shrink-0">
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
                aria-label="Lọc theo giới tính"
                value={selectedGender}
                onChange={(e) => {
                  setSelectedGender(e.target.value);
                  setCurrentPage(1);
                }}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm focus:border-blue-600 focus:outline-none"
              >
                <option value="">Tất cả giới tính</option>
                <option value={Gender.MALE}>Nam</option>
                <option value={Gender.FEMALE}>Nữ</option>
                <option value={Gender.OTHER}>Khác</option>
              </select>

              {(activeSearch || selectedGender || selectedNeighborhoodId) && (
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
              Đang tải danh sách nhân khẩu...
            </div>
          ) : isError ? (
            <Alert
              variant="error"
              message={
                getErrorMessage(error) || 'Không thể tải danh sách nhân khẩu.'
              }
            />
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-12 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 text-xl font-bold">
                👥
              </div>
              <h4 className="mt-3 text-base font-bold text-slate-900">
                Chưa có hồ sơ nhân khẩu nào
              </h4>
              <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
                {activeSearch || selectedGender || selectedNeighborhoodId
                  ? 'Không tìm thấy hồ sơ phù hợp với bộ lọc hiện tại. Thử thay đổi tiêu chí tìm kiếm.'
                  : 'Bắt đầu lập sổ bộ cư dân bằng cách nhấn nút "Thêm mới nhân khẩu" ở trên.'}
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
                      <th className="px-4 py-3">Số CCCD</th>
                      <th className="px-4 py-3">Ngày sinh / Giới tính</th>
                      <th className="px-4 py-3">Mã hộ / Quan hệ</th>
                      <th className="px-4 py-3">Địa chỉ thường trú</th>
                      {isOfficer && <th className="px-4 py-3">Khu phố</th>}
                      <th className="px-4 py-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((profile) => (
                      <tr
                        key={profile.id}
                        className="hover:bg-slate-50/80 transition"
                      >
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {profile.fullName}
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-600">
                          {profile.maskedCitizenId}
                        </td>
                        <td className="px-4 py-3">
                          <span>
                            {new Date(profile.birthDate).toLocaleDateString(
                              'vi-VN',
                            )}
                          </span>
                          <span className="text-slate-400 mx-1">•</span>
                          <Badge variant="outline" className="text-[10px]">
                            {GENDER_LABELS[profile.gender] || profile.gender}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-medium text-slate-900">
                            {profile.household?.code || 'Chưa có'}
                          </span>
                          {profile.relationshipToHead && (
                            <span className="block text-[11px] text-slate-500">
                              {profile.relationshipToHead}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 max-w-xs truncate" title={profile.permanentAddress}>
                          {profile.permanentAddress}
                        </td>
                        {isOfficer && (
                          <td className="px-4 py-3">
                            <Badge variant="info">
                              {profile.neighborhood?.name || 'Khu phố'}
                            </Badge>
                          </td>
                        )}
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenDetail(profile)}
                            className="text-xs"
                          >
                            Xem / Sửa
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards View */}
              <div className="md:hidden space-y-3">
                {items.map((profile) => (
                  <div
                    key={profile.id}
                    className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-slate-900">
                        {profile.fullName}
                      </h4>
                      <Badge variant="outline">
                        {GENDER_LABELS[profile.gender] || profile.gender}
                      </Badge>
                    </div>

                    <p className="text-slate-600">
                      <strong>CCCD:</strong>{' '}
                      <span className="font-mono">{profile.maskedCitizenId}</span>
                    </p>

                    <p className="text-slate-600">
                      <strong>Ngày sinh:</strong>{' '}
                      {new Date(profile.birthDate).toLocaleDateString('vi-VN')}
                    </p>

                    <p className="text-slate-600">
                      <strong>Hộ khẩu:</strong>{' '}
                      {profile.household?.code || 'Chưa có'}{' '}
                      {profile.relationshipToHead && `(${profile.relationshipToHead})`}
                    </p>

                    <p className="text-slate-600">
                      <strong>Thường trú:</strong> {profile.permanentAddress}
                    </p>

                    {isOfficer && profile.neighborhood && (
                      <p className="text-slate-600">
                        <strong>Khu phố:</strong> {profile.neighborhood.name}
                      </p>
                    )}

                    <div className="pt-2 border-t border-slate-200 flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenDetail(profile)}
                        className="w-full text-xs"
                      >
                        Xem chi tiết / Sửa
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

      {/* Create Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Thêm mới Hồ sơ Nhân khẩu"
        description="Nhập thông tin nhân khẩu và hộ khẩu theo quy định quản lý cư trú."
        maxWidth="xl"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
          {createError && (
            <Alert
              variant="error"
              message={createError}
              onClose={() => setCreateError(null)}
            />
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Họ và tên cư dân"
              placeholder="Ví dụ: Nguyễn Văn A"
              value={createForm.fullName}
              onChange={(e) =>
                setCreateForm({ ...createForm, fullName: e.target.value })
              }
              required
              autoFocus
            />

            <Input
              label="Số Căn cước công dân (12 số)"
              placeholder="Ví dụ: 001090123456"
              value={createForm.citizenId}
              onChange={(e) =>
                setCreateForm({ ...createForm, citizenId: e.target.value })
              }
              required
              helperText="Được mã hóa an toàn chuẩn AES-256"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Ngày sinh"
              type="date"
              value={createForm.birthDate}
              onChange={(e) =>
                setCreateForm({ ...createForm, birthDate: e.target.value })
              }
              required
            />

            <Select
              label="Giới tính"
              value={createForm.gender}
              onChange={(e) =>
                setCreateForm({
                  ...createForm,
                  gender: e.target.value as Gender,
                })
              }
              options={[
                { value: Gender.MALE, label: 'Nam' },
                { value: Gender.FEMALE, label: 'Nữ' },
                { value: Gender.OTHER, label: 'Khác' },
              ]}
              required
            />

            <Input
              label="Ngày cấp CCCD (tùy chọn)"
              type="date"
              value={createForm.citizenIdIssueDate || ''}
              onChange={(e) =>
                setCreateForm({
                  ...createForm,
                  citizenIdIssueDate: e.target.value,
                })
              }
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Nơi sinh"
              placeholder="Tỉnh/Thành phố hoặc Bệnh viện"
              value={createForm.placeOfBirth || ''}
              onChange={(e) =>
                setCreateForm({ ...createForm, placeOfBirth: e.target.value })
              }
            />

            <Input
              label="Nghề nghiệp"
              placeholder="Ví dụ: Kỹ sư, Công nhân, Học sinh..."
              value={createForm.occupation || ''}
              onChange={(e) =>
                setCreateForm({ ...createForm, occupation: e.target.value })
              }
            />
          </div>

          {/* Household Info */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <h4 className="font-bold text-slate-800 text-xs">
              Thông tin Hộ khẩu & Nơi cư trú
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Mã số hộ khẩu"
                placeholder="Ví dụ: HK-01 hoặc HK-2024-001"
                value={createForm.householdCode}
                onChange={(e) =>
                  setCreateForm({ ...createForm, householdCode: e.target.value })
                }
                required
                helperText="Tự động liên kết nếu mã hộ đã tồn tại"
              />

              <Select
                label="Quan hệ với chủ hộ"
                value={createForm.relationshipToHead || 'Chủ hộ'}
                onChange={(e) =>
                  setCreateForm({
                    ...createForm,
                    relationshipToHead: e.target.value,
                  })
                }
                options={RELATIONSHIP_OPTIONS}
              />
            </div>

            {isOfficer && (
              <Select
                label="Khu phố trực thuộc"
                placeholder="-- Chọn khu phố --"
                options={neighborhoodOptions}
                value={createForm.neighborhoodId || ''}
                onChange={(e) =>
                  setCreateForm({
                    ...createForm,
                    neighborhoodId: e.target.value,
                  })
                }
                required
              />
            )}

            <Input
              label="Địa chỉ thường trú"
              placeholder="Số nhà, tên đường, khu phố..."
              value={createForm.permanentAddress}
              onChange={(e) =>
                setCreateForm({
                  ...createForm,
                  permanentAddress: e.target.value,
                })
              }
              required
            />

            <Input
              label="Địa chỉ tạm trú / hiện tại (nếu khác thường trú)"
              placeholder="Địa chỉ đang thực tế cư trú"
              value={createForm.currentAddress || ''}
              onChange={(e) =>
                setCreateForm({
                  ...createForm,
                  currentAddress: e.target.value,
                })
              }
            />
          </div>

          {/* Contact Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Số điện thoại liên hệ (tùy chọn)"
              placeholder="Ví dụ: 0912345678"
              value={createForm.phoneNumber || ''}
              onChange={(e) =>
                setCreateForm({ ...createForm, phoneNumber: e.target.value })
              }
              helperText="Được mã hóa tại nơi lưu trữ"
            />

            <Input
              label="Email liên hệ (tùy chọn)"
              placeholder="example@gmail.com"
              type="email"
              value={createForm.email || ''}
              onChange={(e) =>
                setCreateForm({ ...createForm, email: e.target.value })
              }
              helperText="Được mã hóa tại nơi lưu trữ"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setIsCreateModalOpen(false)}
              disabled={createMutation.isPending}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={createMutation.isPending}
            >
              Lưu hồ sơ nhân khẩu
            </Button>
          </div>
        </form>
      </Modal>

      {/* Detail / Edit Modal */}
      <Modal
        isOpen={Boolean(selectedProfileId)}
        onClose={() => {
          setSelectedProfileId(null);
          setIsEditMode(false);
        }}
        title={
          isEditMode
            ? `Chỉnh sửa hồ sơ: ${profileDetail?.fullName || ''}`
            : `Chi tiết nhân khẩu: ${profileDetail?.fullName || ''}`
        }
        description={
          isEditMode
            ? 'Cập nhật thông tin nhân khẩu và lưu lại thay đổi.'
            : 'Thông tin chi tiết được giải mã dành cho người có thẩm quyền.'
        }
        maxWidth="xl"
      >
        {isLoadingDetail ? (
          <div className="py-12 text-center text-xs text-slate-500">
            Đang tải thông tin chi tiết nhân khẩu...
          </div>
        ) : profileDetail ? (
          isEditMode ? (
            <form onSubmit={handleUpdateSubmit} className="space-y-4 text-xs">
              {editError && (
                <Alert
                  variant="error"
                  message={editError}
                  onClose={() => setEditError(null)}
                />
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Họ và tên cư dân"
                  value={editForm.fullName || ''}
                  onChange={(e) =>
                    setEditForm({ ...editForm, fullName: e.target.value })
                  }
                  required
                />

                <Input
                  label="Số Căn cước công dân (12 số)"
                  value={editForm.citizenId || ''}
                  onChange={(e) =>
                    setEditForm({ ...editForm, citizenId: e.target.value })
                  }
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Input
                  label="Ngày sinh"
                  type="date"
                  value={editForm.birthDate || ''}
                  onChange={(e) =>
                    setEditForm({ ...editForm, birthDate: e.target.value })
                  }
                  required
                />

                <Select
                  label="Giới tính"
                  value={editForm.gender || Gender.OTHER}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      gender: e.target.value as Gender,
                    })
                  }
                  options={[
                    { value: Gender.MALE, label: 'Nam' },
                    { value: Gender.FEMALE, label: 'Nữ' },
                    { value: Gender.OTHER, label: 'Khác' },
                  ]}
                />

                <Input
                  label="Ngày cấp CCCD"
                  type="date"
                  value={editForm.citizenIdIssueDate || ''}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      citizenIdIssueDate: e.target.value,
                    })
                  }
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Nơi sinh"
                  value={editForm.placeOfBirth || ''}
                  onChange={(e) =>
                    setEditForm({ ...editForm, placeOfBirth: e.target.value })
                  }
                />

                <Input
                  label="Nghề nghiệp"
                  value={editForm.occupation || ''}
                  onChange={(e) =>
                    setEditForm({ ...editForm, occupation: e.target.value })
                  }
                />
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <h4 className="font-bold text-slate-800 text-xs">
                  Thông tin Hộ khẩu & Nơi cư trú
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Mã số hộ khẩu"
                    value={editForm.householdCode || ''}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        householdCode: e.target.value,
                      })
                    }
                    required
                  />

                  <Select
                    label="Quan hệ với chủ hộ"
                    value={editForm.relationshipToHead || ''}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        relationshipToHead: e.target.value,
                      })
                    }
                    options={RELATIONSHIP_OPTIONS}
                  />
                </div>

                {isOfficer && (
                  <Select
                    label="Khu phố trực thuộc"
                    options={neighborhoodOptions}
                    value={editForm.neighborhoodId || ''}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        neighborhoodId: e.target.value,
                      })
                    }
                  />
                )}

                <Input
                  label="Địa chỉ thường trú"
                  value={editForm.permanentAddress || ''}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      permanentAddress: e.target.value,
                    })
                  }
                  required
                />

                <Input
                  label="Địa chỉ tạm trú / hiện tại"
                  value={editForm.currentAddress || ''}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      currentAddress: e.target.value,
                    })
                  }
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Số điện thoại liên hệ"
                  value={editForm.phoneNumber || ''}
                  onChange={(e) =>
                    setEditForm({ ...editForm, phoneNumber: e.target.value })
                  }
                />

                <Input
                  label="Email liên hệ"
                  type="email"
                  value={editForm.email || ''}
                  onChange={(e) =>
                    setEditForm({ ...editForm, email: e.target.value })
                  }
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={() => setIsEditMode(false)}
                  disabled={updateMutation.isPending}
                >
                  Hủy chỉnh sửa
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  isLoading={updateMutation.isPending}
                >
                  Lưu thay đổi
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4 text-xs">
              {/* Detail View Layout */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl bg-slate-50 p-4 border border-slate-200">
                <div>
                  <span className="text-slate-400 block">Họ và tên:</span>
                  <span className="text-sm font-bold text-slate-900">
                    {profileDetail.fullName}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Số Căn cước công dân:</span>
                  <span className="text-sm font-mono font-bold text-blue-700">
                    {profileDetail.citizenId || profileDetail.maskedCitizenId}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Ngày sinh:</span>
                  <span className="font-semibold text-slate-800">
                    {new Date(profileDetail.birthDate).toLocaleDateString('vi-VN')}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Giới tính:</span>
                  <Badge variant="outline">
                    {GENDER_LABELS[profileDetail.gender] || profileDetail.gender}
                  </Badge>
                </div>
                <div>
                  <span className="text-slate-400 block">Ngày cấp CCCD:</span>
                  <span className="text-slate-800">
                    {profileDetail.citizenIdIssueDate
                      ? new Date(profileDetail.citizenIdIssueDate).toLocaleDateString('vi-VN')
                      : 'Chưa cập nhật'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Nơi sinh:</span>
                  <span className="text-slate-800">
                    {profileDetail.placeOfBirth || 'Chưa cập nhật'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Nghề nghiệp:</span>
                  <span className="text-slate-800">
                    {profileDetail.occupation || 'Chưa cập nhật'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Khu phố quản lý:</span>
                  <Badge variant="info">
                    {profileDetail.neighborhood?.name || 'Khu phố'}
                  </Badge>
                </div>
              </div>

              {/* Household & Address Details */}
              <div className="rounded-xl border border-slate-200 p-4 space-y-2 bg-white">
                <h4 className="font-bold text-slate-900 text-xs">
                  Thông tin Hộ khẩu & Cư trú
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-700">
                  <div>
                    <span className="text-slate-400 block">Mã số hộ khẩu:</span>
                    <span className="font-mono font-semibold">
                      {profileDetail.household?.code || 'Chưa có'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Quan hệ với chủ hộ:</span>
                    <span className="font-semibold">
                      {profileDetail.relationshipToHead || 'Chưa xác định'}
                    </span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-slate-400 block">Địa chỉ thường trú:</span>
                    <span>{profileDetail.permanentAddress}</span>
                  </div>
                  {profileDetail.currentAddress && (
                    <div className="sm:col-span-2">
                      <span className="text-slate-400 block">Địa chỉ tạm trú:</span>
                      <span>{profileDetail.currentAddress}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Contact Details */}
              <div className="rounded-xl border border-slate-200 p-4 space-y-2 bg-white">
                <h4 className="font-bold text-slate-900 text-xs">
                  Thông tin Liên hệ
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-700">
                  <div>
                    <span className="text-slate-400 block">Số điện thoại:</span>
                    <span className="font-mono">
                      {profileDetail.phoneNumber || 'Chưa có'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Email liên hệ:</span>
                    <span>{profileDetail.email || 'Chưa có'}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <span className="text-[11px] text-slate-400">
                  Tạo lúc: {new Date(profileDetail.createdAt).toLocaleString('vi-VN')}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="md"
                    onClick={() => {
                      setSelectedProfileId(null);
                    }}
                  >
                    Đóng
                  </Button>
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => handleStartEdit(profileDetail)}
                  >
                    Chỉnh sửa hồ sơ
                  </Button>
                </div>
              </div>
            </div>
          )
        ) : null}
      </Modal>
    </div>
  );
}
