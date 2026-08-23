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
  ActivityFilterCondition,
  ActivityRating,
  AttendanceStatus,
  Gender,
  NeighborhoodActivityDto,
  UserDto,
  UserRole,
} from '@quanlykhupho/shared-types';
import { useNeighborhoods } from '../../hooks/use-neighborhoods';
import { useResidentProfiles } from '../../hooks/use-resident-profiles';
import {
  useBatchUpdateParticipants,
  useCreateNeighborhoodActivity,
  useMonthlyNeighborhoodActivities,
  useNeighborhoodActivity,
  useUpdateNeighborhoodActivity,
} from '../../hooks/use-neighborhood-activities';
import { getErrorMessage } from '../../lib/api-client';

interface NeighborhoodActivityManagementProps {
  user: UserDto;
}

export const FILTER_CONDITION_LABELS: Record<ActivityFilterCondition, string> = {
  [ActivityFilterCondition.ALL]: 'Tất cả nhân khẩu',
  [ActivityFilterCondition.UNDER_18]: 'Dưới 18 tuổi (< 18)',
  [ActivityFilterCondition.OVER_18]: 'Trên 18 tuổi (> 18)',
  [ActivityFilterCondition.PARTY_MEMBER]: 'Đảng viên',
  [ActivityFilterCondition.CUSTOM]: 'Danh sách tùy chọn',
};

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  [AttendanceStatus.ATTENDED]: 'Có mặt',
  [AttendanceStatus.ABSENT]: 'Vắng mặt',
  [AttendanceStatus.UNCONFIRMED]: 'Chưa xác nhận',
};

export const ACTIVITY_RATING_LABELS: Record<ActivityRating, string> = {
  [ActivityRating.GOOD]: 'Tốt',
  [ActivityRating.FAIR]: 'Khá',
  [ActivityRating.AVERAGE]: 'Trung bình',
};

const GENDER_LABELS: Record<Gender, string> = {
  [Gender.MALE]: 'Nam',
  [Gender.FEMALE]: 'Nữ',
  [Gender.OTHER]: 'Khác',
};

function getCurrentMonthString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function getCurrentDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function NeighborhoodActivityManagement({
  user,
}: NeighborhoodActivityManagementProps) {
  const isOfficer = user.role === UserRole.OFFICER;

  // Monthly navigation and filter state
  const [selectedMonth, setSelectedMonth] = useState<string>(
    getCurrentMonthString(),
  );
  const [selectedNeighborhoodId, setSelectedNeighborhoodId] =
    useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Queries
  const { data: neighborhoods = [] } = useNeighborhoods();
  const effectiveNeighborhoodId = isOfficer
    ? selectedNeighborhoodId || undefined
    : user.neighborhoodId || undefined;

  const {
    data: monthlyData,
    isLoading,
    isError,
    error,
    refetch,
  } = useMonthlyNeighborhoodActivities({
    month: selectedMonth,
    neighborhoodId: effectiveNeighborhoodId,
    page: currentPage,
    limit: 10,
  });

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [createName, setCreateName] = useState<string>('');
  const [createDate, setCreateDate] = useState<string>('');
  const [createDescription, setCreateDescription] = useState<string>('');
  const [createPersonInCharge, setCreatePersonInCharge] =
    useState<string>('');
  const [createFilterCondition, setCreateFilterCondition] =
    useState<ActivityFilterCondition>(ActivityFilterCondition.ALL);
  const [createTargetNeighborhoodId, setCreateTargetNeighborhoodId] =
    useState<string>(user.neighborhoodId || '');
  const [customSelectedResidentIds, setCustomSelectedResidentIds] = useState<
    string[]
  >([]);
  const [customResidentSearch, setCustomResidentSearch] = useState<string>('');
  const [createError, setCreateError] = useState<string | null>(null);

  // Detail & Attendance Sheet Modal state
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(
    null,
  );
  const {
    data: activityDetail,
    isLoading: isLoadingDetail,
    isError: isDetailError,
    error: detailError,
  } = useNeighborhoodActivity(selectedActivityId);

  // Editable local state for attendance sheet
  const [rosterDraft, setRosterDraft] = useState<
    Record<
      string,
      {
        attendance: AttendanceStatus;
        notes: string;
        rating: ActivityRating | null;
      }
    >
  >({});
  const [rosterSearch, setRosterSearch] = useState<string>('');
  const [rosterAttendanceFilter, setRosterAttendanceFilter] =
    useState<string>('');
  const [attendanceSheetError, setAttendanceSheetError] = useState<
    string | null
  >(null);

  // Edit Metadata Modal state
  const [editingActivity, setEditingActivity] =
    useState<NeighborhoodActivityDto | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editDate, setEditDate] = useState<string>('');
  const [editDescription, setEditDescription] = useState<string>('');
  const [editPersonInCharge, setEditPersonInCharge] = useState<string>('');
  const [editError, setEditError] = useState<string | null>(null);

  // Toast feedback
  const [toastFeedback, setToastFeedback] = useState<{
    variant: 'success' | 'error' | 'warning';
    message: string;
  } | null>(null);

  // Mutations
  const createMutation = useCreateNeighborhoodActivity();
  const updateMutation = useUpdateNeighborhoodActivity();
  const batchUpdateMutation = useBatchUpdateParticipants();

  // Resident profiles query for custom filter selection during creation
  const effectiveCreateNeighborhoodId = isOfficer
    ? createTargetNeighborhoodId || undefined
    : user.neighborhoodId || undefined;

  const { data: residentCandidates } = useResidentProfiles({
    neighborhoodId: effectiveCreateNeighborhoodId,
    search: customResidentSearch || undefined,
    page: 1,
    limit: 50,
  }, {
    enabled:
      isCreateModalOpen &&
      createFilterCondition === ActivityFilterCondition.CUSTOM &&
      Boolean(effectiveCreateNeighborhoodId),
  });

  // Month navigation helpers
  const handlePrevMonth = () => {
    const [yearStr, monthStr] = selectedMonth.split('-');
    let y = parseInt(yearStr!, 10);
    let m = parseInt(monthStr!, 10) - 1;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
    setSelectedMonth(`${y}-${String(m).padStart(2, '0')}`);
    setCurrentPage(1);
  };

  const handleNextMonth = () => {
    const [yearStr, monthStr] = selectedMonth.split('-');
    let y = parseInt(yearStr!, 10);
    let m = parseInt(monthStr!, 10) + 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    setSelectedMonth(`${y}-${String(m).padStart(2, '0')}`);
    setCurrentPage(1);
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setCreateName('');
    setCreateDate(getCurrentDateString());
    setCreateDescription('');
    setCreatePersonInCharge('');
    setCreateFilterCondition(ActivityFilterCondition.ALL);
    setCreateTargetNeighborhoodId(user.neighborhoodId || '');
    setCustomSelectedResidentIds([]);
    setCustomResidentSearch('');
    setCreateError(null);
    setIsCreateModalOpen(true);
  };

  // Submit Create Activity
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!createName.trim()) {
      setCreateError('Vui lòng nhập tên hoạt động.');
      return;
    }
    if (!createDate) {
      setCreateError('Vui lòng chọn ngày diễn ra hoạt động.');
      return;
    }
    if (isOfficer && !createTargetNeighborhoodId) {
      setCreateError('Vui lòng chọn khu phố cho hoạt động.');
      return;
    }

    try {
      const res = await createMutation.mutateAsync({
        name: createName.trim(),
        activityDate: createDate,
        description: createDescription.trim() || undefined,
        personInCharge: createPersonInCharge.trim() || undefined,
        filterCondition: createFilterCondition,
        neighborhoodId: isOfficer ? createTargetNeighborhoodId : undefined,
        customResidentIds:
          createFilterCondition === ActivityFilterCondition.CUSTOM
            ? customSelectedResidentIds
            : undefined,
      });

      if (res.warning) {
        setToastFeedback({
          variant: 'warning',
          message: `Đã tạo hoạt động "${res.activity.name}". Lưu ý: ${res.warning}`,
        });
      } else {
        setToastFeedback({
          variant: 'success',
          message: `Đã tạo hoạt động "${res.activity.name}" với danh sách trích xuất ${res.participantCount} nhân khẩu thành công.`,
        });
      }

      setIsCreateModalOpen(false);
      // Auto open detail view of created activity
      handleOpenDetailModal(res.activity.id);
    } catch (err) {
      setCreateError(getErrorMessage(err));
    }
  };

  // Open Detail / Attendance Sheet Modal
  const handleOpenDetailModal = (activityId: string) => {
    setSelectedActivityId(activityId);
    setRosterSearch('');
    setRosterAttendanceFilter('');
    setAttendanceSheetError(null);
    setRosterDraft({});
  };

  // When activityDetail loads, initialize rosterDraft
  React.useEffect(() => {
    if (activityDetail?.participants) {
      const draft: Record<
        string,
        {
          attendance: AttendanceStatus;
          notes: string;
          rating: ActivityRating | null;
        }
      > = {};
      for (const p of activityDetail.participants) {
        draft[p.id] = {
          attendance: p.attendance,
          notes: p.notes || '',
          rating: p.rating || null,
        };
      }
      setRosterDraft(draft);
    }
  }, [activityDetail]);

  const handleUpdateDraft = (
    participantId: string,
    field: 'attendance' | 'notes' | 'rating',
    value: AttendanceStatus | ActivityRating | string | null,
  ) => {
    setRosterDraft((prev) => ({
      ...prev,
      [participantId]: {
        ...prev[participantId],
        attendance:
          field === 'attendance'
            ? (value as AttendanceStatus)
            : prev[participantId]?.attendance || AttendanceStatus.UNCONFIRMED,
        notes:
          field === 'notes'
            ? (value as string)
            : prev[participantId]?.notes || '',
        rating:
          field === 'rating'
            ? (value as ActivityRating | null)
            : prev[participantId]?.rating || null,
      },
    }));
  };

  const handleMarkAllAttendance = (status: AttendanceStatus) => {
    if (!activityDetail?.participants) return;
    setRosterDraft((prev) => {
      const next = { ...prev };
      for (const p of activityDetail.participants) {
        next[p.id] = {
          ...next[p.id],
          attendance: status,
          notes: next[p.id]?.notes || '',
          rating: next[p.id]?.rating || null,
        };
      }
      return next;
    });
  };

  const handleSaveAttendance = async () => {
    if (!selectedActivityId || !activityDetail) return;
    setAttendanceSheetError(null);

    const participantsPayload = activityDetail.participants.map((p) => {
      const draft = rosterDraft[p.id] || {
        attendance: p.attendance,
        notes: p.notes || '',
        rating: p.rating || null,
      };
      return {
        participantId: p.id,
        attendance: draft.attendance,
        notes: draft.notes.trim() || null,
        rating: draft.rating,
      };
    });

    try {
      await batchUpdateMutation.mutateAsync({
        activityId: selectedActivityId,
        dto: { participants: participantsPayload },
      });

      setToastFeedback({
        variant: 'success',
        message: 'Đã lưu danh sách điểm danh và đánh giá thành công.',
      });
    } catch (err) {
      setAttendanceSheetError(getErrorMessage(err));
    }
  };

  // Open Edit Metadata Modal
  const handleOpenEditMetadata = (activity: NeighborhoodActivityDto) => {
    setEditingActivity(activity);
    setEditName(activity.name);
    setEditDate(activity.activityDate.slice(0, 10));
    setEditDescription(activity.description || '');
    setEditPersonInCharge(activity.personInCharge || '');
    setEditError(null);
  };

  const handleSaveMetadata = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingActivity) return;
    setEditError(null);

    if (!editName.trim()) {
      setEditError('Vui lòng nhập tên hoạt động.');
      return;
    }
    if (!editDate) {
      setEditError('Vui lòng chọn ngày diễn ra.');
      return;
    }

    try {
      await updateMutation.mutateAsync({
        id: editingActivity.id,
        dto: {
          name: editName.trim(),
          activityDate: editDate,
          description: editDescription.trim() || null,
          personInCharge: editPersonInCharge.trim() || null,
        },
      });

      setToastFeedback({
        variant: 'success',
        message: `Đã cập nhật thông tin hoạt động "${editName}" thành công.`,
      });
      setEditingActivity(null);
    } catch (err) {
      setEditError(getErrorMessage(err));
    }
  };

  const activities = monthlyData?.items || [];
  const total = monthlyData?.total || 0;
  const totalPages = monthlyData?.totalPages || 1;

  // Monthly stats calculations
  const totalMonthParticipants = activities.reduce(
    (sum, a) => sum + a.totalParticipants,
    0,
  );
  const totalMonthAttended = activities.reduce(
    (sum, a) => sum + a.attendedCount,
    0,
  );
  const totalMonthAbsent = activities.reduce(
    (sum, a) => sum + a.absentCount,
    0,
  );
  const totalMonthUnconfirmed = activities.reduce(
    (sum, a) => sum + a.unconfirmedCount,
    0,
  );

  // Filtered participant list for detail sheet
  const filteredParticipants = (activityDetail?.participants || []).filter(
    (p) => {
      if (
        rosterSearch &&
        !p.fullName.toLowerCase().includes(rosterSearch.toLowerCase().trim())
      ) {
        return false;
      }
      const currentAttendance =
        rosterDraft[p.id]?.attendance !== undefined
          ? rosterDraft[p.id]!.attendance
          : p.attendance;
      if (
        rosterAttendanceFilter &&
        currentAttendance !== rosterAttendanceFilter
      ) {
        return false;
      }
      return true;
    },
  );

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
                <CardTitle>Sổ tay Hoạt động Khu Phố</CardTitle>
                <Badge variant="info">{total} hoạt động</Badge>
              </div>
              <CardDescription>
                {isOfficer
                  ? 'Theo dõi, tổ chức và quản lý điểm danh các hoạt động dân phố toàn phường theo tháng'
                  : `Quản lý sổ tay hoạt động, trích xuất danh sách nhân khẩu và ghi nhận điểm danh tại ${user.neighborhood?.name || 'Khu phố'}`}
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                size="md"
                onClick={handleOpenCreateModal}
                className="text-xs sm:text-sm font-semibold"
              >
                + Tạo hoạt động mới
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

          {/* Monthly navigation & neighborhood filter toolbar */}
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Month Navigator */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevMonth}
                className="text-xs shrink-0"
              >
                ◀ Tháng trước
              </Button>

              <div className="flex items-center gap-1.5">
                <label
                  htmlFor="month-picker"
                  className="text-xs font-semibold text-slate-700 whitespace-nowrap"
                >
                  Tháng:
                </label>
                <input
                  id="month-picker"
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => {
                    if (e.target.value) {
                      setSelectedMonth(e.target.value);
                      setCurrentPage(1);
                    }
                  }}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 shadow-sm focus:border-blue-600 focus:outline-none"
                />
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleNextMonth}
                className="text-xs shrink-0"
              >
                Tháng sau ▶
              </Button>
            </div>

            {/* Officer Neighborhood Filter */}
            {isOfficer && (
              <div className="flex items-center gap-2">
                <label
                  htmlFor="officer-neighborhood-filter"
                  className="text-xs font-semibold text-slate-700 whitespace-nowrap"
                >
                  Khu phố:
                </label>
                <select
                  id="officer-neighborhood-filter"
                  aria-label="Lọc theo khu phố"
                  value={selectedNeighborhoodId}
                  onChange={(e) => {
                    setSelectedNeighborhoodId(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 shadow-sm focus:border-blue-600 focus:outline-none"
                >
                  <option value="">Tất cả các khu phố</option>
                  {neighborhoods.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Month Summary Stats Bar */}
          {activities.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 pt-3 border-t border-slate-100 text-xs">
              <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-200 text-center">
                <span className="text-slate-500 block">Tổng hoạt động</span>
                <span className="text-base font-bold text-slate-900">
                  {total}
                </span>
              </div>
              <div className="rounded-lg bg-emerald-50 p-2.5 border border-emerald-200 text-center">
                <span className="text-emerald-700 block">Có mặt</span>
                <span className="text-base font-bold text-emerald-800">
                  {totalMonthAttended} / {totalMonthParticipants}
                </span>
              </div>
              <div className="rounded-lg bg-rose-50 p-2.5 border border-rose-200 text-center">
                <span className="text-rose-700 block">Vắng mặt</span>
                <span className="text-base font-bold text-rose-800">
                  {totalMonthAbsent}
                </span>
              </div>
              <div className="rounded-lg bg-amber-50 p-2.5 border border-amber-200 text-center">
                <span className="text-amber-700 block">Chưa điểm danh</span>
                <span className="text-base font-bold text-amber-800">
                  {totalMonthUnconfirmed}
                </span>
              </div>
            </div>
          )}
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-slate-500 text-xs">
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
              Đang tải danh sách hoạt động...
            </div>
          ) : isError ? (
            <Alert
              variant="error"
              message={
                getErrorMessage(error) ||
                'Không thể tải danh sách hoạt động khu phố.'
              }
            />
          ) : activities.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-12 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 text-xl font-bold">
                📅
              </div>
              <h4 className="mt-3 text-base font-bold text-slate-900">
                Chưa có hoạt động nào trong tháng {selectedMonth}
              </h4>
              <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
                Bấm vào nút &quot;Tạo hoạt động mới&quot; để thiết lập buổi họp,
                sinh hoạt cộng đồng với danh sách trích xuất nhân khẩu tự động.
              </p>
              <div className="mt-4">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleOpenCreateModal}
                >
                  + Tạo hoạt động ngay
                </Button>
              </div>
            </div>
          ) : (
            <div>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Tên hoạt động</th>
                      <th className="px-4 py-3">Ngày diễn ra</th>
                      {isOfficer && <th className="px-4 py-3">Khu phố</th>}
                      <th className="px-4 py-3">Đối tượng tham gia</th>
                      <th className="px-4 py-3">Điểm danh & Tỷ lệ</th>
                      <th className="px-4 py-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activities.map((item) => (
                      <tr
                        key={item.id}
                        className="hover:bg-slate-50/80 transition"
                      >
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          <div>{item.name}</div>
                          {item.description && (
                            <div className="text-[11px] text-slate-400 font-normal truncate max-w-xs">
                              {item.description}
                            </div>
                          )}
                          {item.personInCharge && (
                            <div className="text-[11px] text-slate-500 font-normal">
                              Phụ trách: {item.personInCharge}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-800 whitespace-nowrap">
                          {new Date(item.activityDate).toLocaleDateString('vi-VN')}
                        </td>
                        {isOfficer && (
                          <td className="px-4 py-3">
                            <Badge variant="info">
                              {item.neighborhoodName || 'Khu phố'}
                            </Badge>
                          </td>
                        )}
                        <td className="px-4 py-3">
                          <Badge variant="default">
                            {FILTER_CONDITION_LABELS[item.filterCondition] ||
                              item.filterCondition}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-emerald-700">
                              {item.attendedCount}
                            </span>
                            <span className="text-slate-400">/</span>
                            <span className="font-semibold text-slate-900">
                              {item.totalParticipants}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              (Vắng: {item.absentCount})
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right space-x-1 whitespace-nowrap">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleOpenDetailModal(item.id)}
                            className="text-xs"
                          >
                            Điểm danh ({item.totalParticipants})
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenEditMetadata(item)}
                            className="text-xs"
                          >
                            Sửa
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards View */}
              <div className="md:hidden space-y-3">
                {activities.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-bold text-slate-900 leading-tight">
                        {item.name}
                      </h4>
                      <Badge variant="default" className="shrink-0 text-[10px]">
                        {FILTER_CONDITION_LABELS[item.filterCondition] ||
                          item.filterCondition}
                      </Badge>
                    </div>

                    <p className="text-slate-600">
                      <strong>Ngày:</strong>{' '}
                      {new Date(item.activityDate).toLocaleDateString('vi-VN')}
                    </p>

                    {isOfficer && item.neighborhoodName && (
                      <p className="text-slate-600">
                        <strong>Khu phố:</strong> {item.neighborhoodName}
                      </p>
                    )}

                    {item.description && (
                      <p className="text-slate-500 line-clamp-2">
                        {item.description}
                      </p>
                    )}

                    {item.personInCharge && (
                      <p className="text-slate-600">
                        <strong>Phụ trách:</strong> {item.personInCharge}
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-1 text-slate-700 border-t border-slate-200/60">
                      <span>Điểm danh:</span>
                      <span className="font-semibold">
                        Có mặt: {item.attendedCount} / {item.totalParticipants}{' '}
                        • Vắng: {item.absentCount}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-200 flex gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleOpenDetailModal(item.id)}
                        className="flex-1 text-xs"
                      >
                        Sổ điểm danh
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenEditMetadata(item)}
                        className="text-xs"
                      >
                        Sửa
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
                    <strong>{totalPages}</strong> (Tổng {total} hoạt động)
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

      {/* Create Activity Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Tạo Hoạt động Khu Phố Mới"
        description="Khởi tạo hoạt động và trích xuất danh sách nhân khẩu tham gia tự động theo điều kiện."
        maxWidth="lg"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
          {createError && (
            <Alert
              variant="error"
              message={createError}
              onClose={() => setCreateError(null)}
            />
          )}

          <Input
            label="Tên hoạt động"
            placeholder="Ví dụ: Họp tổ dân phố tháng 8/2026, Sinh hoạt hè..."
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            required
            maxLength={255}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Ngày diễn ra hoạt động"
              type="date"
              value={createDate}
              onChange={(e) => setCreateDate(e.target.value)}
              required
            />

            {isOfficer ? (
              <Select
                label="Khu phố tổ chức"
                value={createTargetNeighborhoodId}
                onChange={(e) => {
                  setCreateTargetNeighborhoodId(e.target.value);
                  setCustomSelectedResidentIds([]);
                  setCustomResidentSearch('');
                }}
                options={[
                  { value: '', label: '-- Chọn khu phố --' },
                  ...neighborhoods.map((n) => ({
                    value: n.id,
                    label: n.name,
                  })),
                ]}
                required
              />
            ) : (
              <div className="flex flex-col justify-end">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Khu phố tổ chức
                </label>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-800">
                  {user.neighborhood?.name || 'Khu phố của bạn'}
                </div>
              </div>
            )}
          </div>

          <Select
            label="Điều kiện trích xuất danh sách tham gia"
            value={createFilterCondition}
            onChange={(e) =>
              setCreateFilterCondition(
                e.target.value as ActivityFilterCondition,
              )
            }
            options={[
              {
                value: ActivityFilterCondition.ALL,
                label: 'Tất cả nhân khẩu trong khu phố',
              },
              {
                value: ActivityFilterCondition.UNDER_18,
                label: 'Dưới 18 tuổi (< 18 tuổi vào ngày diễn ra)',
              },
              {
                value: ActivityFilterCondition.OVER_18,
                label: 'Trên 18 tuổi (> 18 tuổi vào ngày diễn ra)',
              },
              {
                value: ActivityFilterCondition.PARTY_MEMBER,
                label: 'Đảng viên thuộc khu phố',
              },
              {
                value: ActivityFilterCondition.CUSTOM,
                label: 'Danh sách tùy chọn (chọn thủ công)',
              },
            ]}
            required
          />

          <Input
            label="Người phụ trách"
            placeholder="Ví dụ: Nguyễn Văn A, Ban công tác Mặt trận..."
            value={createPersonInCharge}
            onChange={(e) => setCreatePersonInCharge(e.target.value)}
            maxLength={255}
          />

          {/* Custom Resident Selector */}
          {createFilterCondition === ActivityFilterCondition.CUSTOM && (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-800 text-xs">
                  Chọn nhân khẩu tham gia ({customSelectedResidentIds.length} đã
                  chọn)
                </h4>
              </div>

              <Input
                placeholder="Tìm kiếm nhân khẩu theo họ tên..."
                value={customResidentSearch}
                onChange={(e) => setCustomResidentSearch(e.target.value)}
                className="text-xs bg-white"
              />

              <div className="max-h-48 overflow-y-auto space-y-1.5 rounded-lg border border-slate-200 bg-white p-2">
                {residentCandidates?.items &&
                residentCandidates.items.length > 0 ? (
                  residentCandidates.items.map((res) => {
                    const isSelected = customSelectedResidentIds.includes(
                      res.id,
                    );
                    return (
                      <label
                        key={res.id}
                        className="flex items-center gap-2.5 p-1.5 rounded hover:bg-slate-50 cursor-pointer text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setCustomSelectedResidentIds((prev) => [
                                ...prev,
                                res.id,
                              ]);
                            } else {
                              setCustomSelectedResidentIds((prev) =>
                                prev.filter((id) => id !== res.id),
                              );
                            }
                          }}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="flex-1">
                          <span className="font-semibold text-slate-900">
                            {res.fullName}
                          </span>
                          <span className="text-[11px] text-slate-400 ml-2">
                            ({new Date(res.birthDate).toLocaleDateString('vi-VN')}{' '}
                            • {GENDER_LABELS[res.gender] || res.gender})
                          </span>
                        </div>
                      </label>
                    );
                  })
                ) : (
                  <p className="text-center py-4 text-slate-400 text-xs">
                    Không tìm thấy nhân khẩu nào.
                  </p>
                )}
              </div>
            </div>
          )}

          <div>
            <label
              htmlFor="create-activity-description"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Nội dung / Mô tả hoạt động (tùy chọn)
            </label>
            <textarea
              id="create-activity-description"
              className="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900 transition-colors focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-1"
              rows={3}
              placeholder="Nhập nội dung, chương trình hoặc ghi chú bổ sung..."
              value={createDescription}
              onChange={(e) => setCreateDescription(e.target.value)}
              maxLength={4000}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
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
              Tạo hoạt động & Trích xuất danh sách
            </Button>
          </div>
        </form>
      </Modal>

      {/* Activity Detail & Attendance Sheet Modal */}
      <Modal
        isOpen={Boolean(selectedActivityId)}
        onClose={() => setSelectedActivityId(null)}
        title={activityDetail?.name || 'Sổ Điểm danh Hoạt động'}
        description={
          activityDetail
            ? `Ngày: ${new Date(activityDetail.activityDate).toLocaleDateString('vi-VN')} • Đối tượng: ${FILTER_CONDITION_LABELS[activityDetail.filterCondition]}`
            : ''
        }
        maxWidth="xl"
      >
        {isDetailError ? (
          <Alert
            variant="error"
            message={
              getErrorMessage(detailError) ||
              'Không thể tải sổ hoạt động. Vui lòng kiểm tra quyền truy cập và thử lại.'
            }
          />
        ) : isLoadingDetail || !activityDetail ? (
          <div className="py-16 text-center text-slate-500 text-xs">
            Đang tải dữ liệu điểm danh...
          </div>
        ) : (
          <div className="space-y-4 text-xs">
            {attendanceSheetError && (
              <Alert
                variant="error"
                message={attendanceSheetError}
                onClose={() => setAttendanceSheetError(null)}
              />
            )}

            {/* Activity Summary Info */}
            <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200 space-y-2">
              {activityDetail.description && (
                <p className="text-slate-700 italic text-xs">
                  &quot;{activityDetail.description}&quot;
                </p>
              )}

              {activityDetail.personInCharge && (
                <p className="text-slate-700 text-xs">
                  <strong>Người phụ trách:</strong>{' '}
                  {activityDetail.personInCharge}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200 text-[11px]">
                <div>
                  <strong>Người tạo:</strong>{' '}
                  {activityDetail.createdByName || 'Cán bộ quản lý'} •{' '}
                  <strong>Khu phố:</strong> {activityDetail.neighborhoodName}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-emerald-700">
                    Có mặt: {activityDetail.attendedCount}
                  </span>
                  <span>•</span>
                  <span className="font-semibold text-rose-700">
                    Vắng: {activityDetail.absentCount}
                  </span>
                  <span>•</span>
                  <span className="font-semibold text-amber-700">
                    Chưa xác nhận: {activityDetail.unconfirmedCount}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions & Filters Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2">
              <div className="flex items-center gap-2 flex-1 max-w-sm">
                <Input
                  placeholder="Tìm theo họ tên người tham gia..."
                  value={rosterSearch}
                  onChange={(e) => setRosterSearch(e.target.value)}
                  className="text-xs"
                />
                <select
                  aria-label="Lọc theo trạng thái điểm danh"
                  value={rosterAttendanceFilter}
                  onChange={(e) => setRosterAttendanceFilter(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-800 focus:border-blue-600 focus:outline-none"
                >
                  <option value="">Tất cả trạng thái</option>
                  <option value={AttendanceStatus.ATTENDED}>Có mặt</option>
                  <option value={AttendanceStatus.ABSENT}>Vắng mặt</option>
                  <option value={AttendanceStatus.UNCONFIRMED}>
                    Chưa xác nhận
                  </option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    handleMarkAllAttendance(AttendanceStatus.ATTENDED)
                  }
                  className="text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                >
                  ✓ Tất cả có mặt
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    handleMarkAllAttendance(AttendanceStatus.ABSENT)
                  }
                  className="text-xs text-rose-700 border-rose-300 hover:bg-rose-50"
                >
                  ✕ Tất cả vắng
                </Button>
              </div>
            </div>

            {/* Participant Roster Sheet */}
            <div className="max-h-96 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100 bg-white">
              {filteredParticipants.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  {activityDetail.participants.length === 0
                    ? 'Danh sách người tham gia hoạt động này hiện đang trống.'
                    : 'Không tìm thấy người tham gia phù hợp với tìm kiếm.'}
                </div>
              ) : (
                filteredParticipants.map((p) => {
                  const draft = rosterDraft[p.id] || {
                    attendance: p.attendance,
                    notes: p.notes || '',
                    rating: p.rating || null,
                  };

                  return (
                    <div
                      key={p.id}
                      className="p-3 hover:bg-slate-50/80 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-0.5 min-w-[160px]">
                        <div className="font-bold text-slate-900 text-xs">
                          {p.fullName}
                        </div>
                      </div>

                      {/* Attendance Buttons */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateDraft(
                              p.id,
                              'attendance',
                              AttendanceStatus.ATTENDED,
                            )
                          }
                          className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                            draft.attendance === AttendanceStatus.ATTENDED
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          Có mặt
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateDraft(
                              p.id,
                              'attendance',
                              AttendanceStatus.ABSENT,
                            )
                          }
                          className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                            draft.attendance === AttendanceStatus.ABSENT
                              ? 'bg-rose-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          Vắng mặt
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateDraft(
                              p.id,
                              'attendance',
                              AttendanceStatus.UNCONFIRMED,
                            )
                          }
                          className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                            draft.attendance === AttendanceStatus.UNCONFIRMED
                              ? 'bg-amber-500 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          Chưa rõ
                        </button>
                      </div>

                      {/* Rating & Notes inputs */}
                      <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                        <select
                          aria-label="Đánh giá"
                          value={draft.rating || ''}
                          onChange={(e) =>
                            handleUpdateDraft(
                              p.id,
                              'rating',
                              e.target.value || null,
                            )
                          }
                          className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 focus:border-blue-600 focus:outline-none shrink-0"
                        >
                          <option value="">-- Đánh giá --</option>
                          <option value={ActivityRating.GOOD}>Tốt</option>
                          <option value={ActivityRating.FAIR}>Khá</option>
                          <option value={ActivityRating.AVERAGE}>
                            Trung bình
                          </option>
                        </select>

                        <input
                          type="text"
                          placeholder="Ghi chú đóng góp..."
                          value={draft.notes}
                          onChange={(e) =>
                            handleUpdateDraft(p.id, 'notes', e.target.value)
                          }
                          maxLength={1000}
                          className="flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-800 focus:border-blue-600 focus:outline-none"
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => setSelectedActivityId(null)}
              >
                Đóng
              </Button>

              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={handleSaveAttendance}
                isLoading={batchUpdateMutation.isPending}
                disabled={activityDetail.participants.length === 0}
              >
                Lưu kết quả điểm danh & đánh giá
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Metadata Modal */}
      <Modal
        isOpen={Boolean(editingActivity)}
        onClose={() => setEditingActivity(null)}
        title="Chỉnh sửa Thông tin Hoạt động"
        description="Cập nhật tên, thời gian hoặc mô tả hoạt động. Danh sách người tham gia được giữ nguyên cố định."
        maxWidth="md"
      >
        <form onSubmit={handleSaveMetadata} className="space-y-4 text-xs">
          {editError && (
            <Alert
              variant="error"
              message={editError}
              onClose={() => setEditError(null)}
            />
          )}

          <Input
            label="Tên hoạt động"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            required
            maxLength={255}
          />

          <Input
            label="Ngày diễn ra hoạt động"
            type="date"
            value={editDate}
            onChange={(e) => setEditDate(e.target.value)}
            required
          />

          <Input
            label="Người phụ trách"
            value={editPersonInCharge}
            onChange={(e) => setEditPersonInCharge(e.target.value)}
            maxLength={255}
          />

          <div>
            <label
              htmlFor="edit-activity-description"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Mô tả hoạt động
            </label>
            <textarea
              id="edit-activity-description"
              className="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900 transition-colors focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-1"
              rows={3}
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              maxLength={4000}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setEditingActivity(null)}
              disabled={updateMutation.isPending}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={updateMutation.isPending}
            >
              Cập nhật thông tin
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
