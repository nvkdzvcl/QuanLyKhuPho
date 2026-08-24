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
} from '@quanlykhupho/ui';
import { ExportDataset, UserDto, UserRole } from '@quanlykhupho/shared-types';
import {
  useApproveResident,
  useLockResident,
  usePendingResidents,
  useRejectResident,
} from '../../hooks/use-pending-residents';
import { getErrorMessage } from '../../lib/api-client';

import {
  getLeaderNavigationItems,
  normalizeSectionForRole,
} from './dashboard-navigation';
import { RoleWorkspace } from './role-workspace';
import { LeaderOverview } from './leader-overview';
import { AnnouncementFeed } from '../announcements/announcement-feed';
import { PetitionList } from '../petitions/petition-list';
import { ResidentProfileManagement } from '../resident-profiles/resident-profile-management';
import { PoliticalSocialManagement } from '../political-social-profiles/political-social-management';
import {
  ActivityCreationSeed,
  NeighborhoodActivityManagement,
} from '../neighborhood-activities/neighborhood-activity-management';
import { ExportModal } from '../exports/export-modal';

interface LeaderViewProps {
  user: UserDto;
}

export function LeaderView({ user }: LeaderViewProps) {
  const [activeSection, setActiveSection] = useState<string>('overview');
  const [activityCreationSeed, setActivityCreationSeed] =
    useState<ActivityCreationSeed | null>(null);

  const {
    data: pendingResidents = [],
    isLoading,
    isError,
    error,
  } = usePendingResidents();

  const approveMutation = useApproveResident();
  const rejectMutation = useRejectResident();
  const lockMutation = useLockResident();

  // Modal states for Moderation
  const [rejectingResident, setRejectingResident] = useState<UserDto | null>(
    null,
  );
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState<string | null>(null);

  const [lockingResident, setLockingResident] = useState<UserDto | null>(null);
  const [lockReason, setLockReason] = useState('');
  const [lockError, setLockError] = useState<string | null>(null);

  // Modal state for Exports
  const [exportModalDataset, setExportModalDataset] =
    useState<ExportDataset | null>(null);

  const [toastFeedback, setToastFeedback] = useState<{
    variant: 'success' | 'error';
    message: string;
  } | null>(null);

  const handleApprove = async (resident: UserDto) => {
    try {
      await approveMutation.mutateAsync(resident.id);
      setToastFeedback({
        variant: 'success',
        message: `Đã phê duyệt tài khoản cư dân "${resident.fullName}" thành công.`,
      });
    } catch (err) {
      setToastFeedback({
        variant: 'error',
        message: getErrorMessage(err),
      });
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectingResident) return;
    if (!rejectReason.trim()) {
      setRejectError('Vui lòng nhập lý do từ chối hồ sơ');
      return;
    }

    try {
      await rejectMutation.mutateAsync({
        residentId: rejectingResident.id,
        dto: { reason: rejectReason.trim() },
      });
      setToastFeedback({
        variant: 'success',
        message: `Đã từ chối hồ sơ "${rejectingResident.fullName}".`,
      });
      setRejectingResident(null);
      setRejectReason('');
      setRejectError(null);
    } catch (err) {
      setRejectError(getErrorMessage(err));
    }
  };

  const handleConfirmLock = async () => {
    if (!lockingResident) return;
    if (!lockReason.trim()) {
      setLockError('Vui lòng nhập lý do khóa tài khoản');
      return;
    }

    try {
      await lockMutation.mutateAsync({
        residentId: lockingResident.id,
        dto: { reason: lockReason.trim() },
      });
      setToastFeedback({
        variant: 'success',
        message: `Đã khóa tài khoản "${lockingResident.fullName}".`,
      });
      setLockingResident(null);
      setLockReason('');
      setLockError(null);
    } catch (err) {
      setLockError(getErrorMessage(err));
    }
  };

  const currentSection = normalizeSectionForRole(
    UserRole.LEADER,
    activeSection,
  );
  const navItems = getLeaderNavigationItems({
    pendingResidentsCount: pendingResidents.length,
  });

  return (
    <RoleWorkspace
      user={user}
      title={`Tổng quan ${user.neighborhood?.name || 'Khu phố'}`}
      subtitle={
        <span>
          Trưởng khu phố: <strong>{user.fullName}</strong> ({user.maskedPhone}) • {user.neighborhood?.ward || 'Địa bàn phụ trách'}
        </span>
      }
      badgeText="Trưởng khu phố"
      items={navItems}
      activeSection={currentSection}
      onSectionChange={setActiveSection}
    >
      {/* Toast Feedback Alert */}
      {toastFeedback && (
        <Alert
          variant={toastFeedback.variant}
          message={toastFeedback.message}
          onClose={() => setToastFeedback(null)}
        />
      )}

      {/* Section 1: Overview (Action-First Work Queue & Stats) */}
      {currentSection === 'overview' && (
        <LeaderOverview
          user={user}
          pendingResidents={pendingResidents}
          isLoadingPending={isLoading}
          isErrorPending={isError}
          pendingError={error}
          onApproveResident={handleApprove}
          onOpenRejectModal={(res) => {
            setRejectingResident(res);
            setRejectReason('');
            setRejectError(null);
          }}
          isApproving={approveMutation.isPending}
          onNavigateSection={(sectionId) => setActiveSection(sectionId)}
        />
      )}

      {/* Section 2: Account Moderation (Full Pending Queue & Policy) */}
      {currentSection === 'moderation' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>Danh sách Cư dân chờ phê duyệt</CardTitle>
                  <CardDescription>
                    Hồ sơ cư dân tự đăng ký qua số điện thoại thuộc {user.neighborhood?.name}
                  </CardDescription>
                </div>
                <Badge variant={pendingResidents.length > 0 ? 'warning' : 'success'}>
                  {pendingResidents.length} hồ sơ chờ
                </Badge>
              </div>
            </CardHeader>

            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12 text-slate-500">
                  <svg
                    className="animate-spin h-6 w-6 mr-2 text-amber-600"
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
                    'Không thể tải danh sách hồ sơ.'
                  }
                />
              ) : pendingResidents.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 text-xl font-bold">
                    ✓
                  </div>
                  <h4 className="mt-3 text-base font-bold text-slate-900">
                    Không có hồ sơ nào đang chờ duyệt
                  </h4>
                  <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
                    Tất cả cư dân đăng ký vào khu phố đã được xử lý. Hồ sơ mới sẽ hiển thị tại đây khi có cư dân đăng ký.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingResidents.map((res) => (
                    <div
                      key={res.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4 transition hover:bg-white hover:shadow-sm"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-bold text-slate-900 leading-tight">
                            {res.fullName}
                          </h4>
                          <Badge variant="warning">Chờ duyệt</Badge>
                        </div>
                        <p className="text-xs text-slate-600">
                          <strong>Số điện thoại:</strong>{' '}
                          <span className="font-mono">{res.maskedPhone}</span>
                        </p>
                        <p className="text-xs text-slate-600">
                          <strong>Địa chỉ:</strong> {res.address || 'Chưa có thông tin'}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Đăng ký lúc: {new Date(res.createdAt).toLocaleString('vi-VN')}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 border-t border-slate-200 pt-3 sm:border-t-0 sm:pt-0">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleApprove(res)}
                          isLoading={approveMutation.isPending}
                          className="flex-1 sm:flex-initial"
                        >
                          Duyệt hồ sơ
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            setRejectingResident(res);
                            setRejectReason('');
                            setRejectError(null);
                          }}
                          className="flex-1 sm:flex-initial"
                        >
                          Từ chối
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setLockingResident(res);
                            setLockReason('');
                            setLockError(null);
                          }}
                          className="text-xs"
                        >
                          Khóa
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Moderation Guidance & Policy */}
          <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4 text-xs text-blue-900 space-y-2">
            <h5 className="font-bold text-blue-950 flex items-center gap-1.5">
              <span>📋</span>
              <span>Quy định xét duyệt tài khoản cư dân:</span>
            </h5>
            <ul className="list-disc list-inside space-y-1 text-blue-800">
              <li>
                <strong>Duyệt hồ sơ:</strong> Xác nhận cư dân thực sự cư trú tại khu phố. Tài khoản sẽ được chuyển sang trạng thái hoạt động ngay lập tức.
              </li>
              <li>
                <strong>Từ chối hồ sơ:</strong> Yêu cầu nêu rõ lý do (ví dụ: sai thông tin, không thuộc khu phố). Tin nhắn SMS thông báo sẽ được gửi tới người đăng ký.
              </li>
              <li>
                <strong>Khóa tài khoản:</strong> Dành cho tài khoản vi phạm hoặc đã chuyển đi nơi khác. Toàn bộ phiên đăng nhập của tài khoản sẽ bị thu hồi ngay.
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* Section 3: Announcements */}
      {currentSection === 'announcements' && <AnnouncementFeed user={user} />}

      {/* Section 4: Petitions */}
      {currentSection === 'petitions' && <PetitionList user={user} />}

      {/* Section 5: Resident Profiles */}
      {currentSection === 'resident-profiles' && (
        <ResidentProfileManagement
          user={user}
          onSeedActivity={(seed) => {
            setActivityCreationSeed(seed);
            setActiveSection('activities');
          }}
        />
      )}

      {/* Section 6: Political & Social Profiles */}
      {currentSection === 'political-social' && (
        <PoliticalSocialManagement user={user} />
      )}

      {/* Section 7: Neighborhood Activities */}
      {currentSection === 'activities' && (
        <NeighborhoodActivityManagement
          user={user}
          creationSeed={activityCreationSeed}
          onCreationSeedConsumed={() => setActivityCreationSeed(null)}
        />
      )}

      {/* Section 8: Reports & Exports */}
      {currentSection === 'exports' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Báo cáo & Xuất dữ liệu Khu phố</CardTitle>
              <CardDescription>
                Trích xuất danh sách nhân khẩu, sổ hoạt động và dữ liệu tổng hợp theo định dạng CSV hoặc Microsoft Excel
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Export Residents */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700 text-lg font-bold">
                      👥
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">
                        Danh sách Cư dân & Hộ khẩu
                      </h4>
                      <p className="text-xs text-slate-500">
                        Họ tên, năm sinh, giới tính, quan hệ chủ hộ và địa chỉ
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setExportModalDataset(ExportDataset.RESIDENTS)}
                    className="w-full text-xs"
                  >
                    Xuất danh sách cư dân
                  </Button>
                </div>

                {/* Export Political Social */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700 text-lg font-bold">
                      🎖️
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">
                        Thông tin Chính trị - Xã hội
                      </h4>
                      <p className="text-xs text-slate-500">
                        Hồ sơ Đảng viên, đoàn thể, trình độ học vấn và diện chính sách
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() =>
                      setExportModalDataset(ExportDataset.POLITICAL_SOCIAL)
                    }
                    className="w-full text-xs"
                  >
                    Xuất danh sách chính trị - XH
                  </Button>
                </div>

                {/* Export Activities */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 text-lg font-bold">
                      📖
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">
                        Sổ hoạt động Khu phố
                      </h4>
                      <p className="text-xs text-slate-500">
                        Nhật ký các phong trào, sự kiện, người tham dự và đánh giá
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() =>
                      setExportModalDataset(ExportDataset.ACTIVITIES)
                    }
                    className="w-full text-xs"
                  >
                    Xuất sổ hoạt động
                  </Button>
                </div>

                {/* Export Petitions */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-700 text-lg font-bold">
                      📬
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">
                        Danh sách Ý kiến & Kiến nghị
                      </h4>
                      <p className="text-xs text-slate-500">
                        Tổng hợp các phản ánh của cư dân và trạng thái xử lý
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() =>
                      setExportModalDataset(ExportDataset.PETITIONS)
                    }
                    className="w-full text-xs"
                  >
                    Xuất danh sách kiến nghị
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Reject Modal */}
      <Modal
        isOpen={Boolean(rejectingResident)}
        onClose={() => setRejectingResident(null)}
        title="Từ chối hồ sơ cư dân"
        description={`Bạn đang từ chối hồ sơ của cư dân: ${rejectingResident?.fullName}`}
        footer={
          <>
            <Button
              variant="outline"
              size="md"
              onClick={() => setRejectingResident(null)}
              disabled={rejectMutation.isPending}
            >
              Hủy
            </Button>
            <Button
              variant="destructive"
              size="md"
              onClick={handleConfirmReject}
              isLoading={rejectMutation.isPending}
            >
              Xác nhận từ chối
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {rejectError && (
            <Alert
              variant="error"
              message={rejectError}
              onClose={() => setRejectError(null)}
            />
          )}
          <Input
            label="Lý do từ chối (bắt buộc)"
            placeholder="Ví dụ: Sai địa chỉ cư trú, không thuộc khu phố..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            required
            autoFocus
            helperText="Lý do từ chối sẽ được lưu trữ và thông báo tới người đăng ký qua tin nhắn SMS."
          />
        </div>
      </Modal>

      {/* Lock Modal */}
      <Modal
        isOpen={Boolean(lockingResident)}
        onClose={() => setLockingResident(null)}
        title="Khóa tài khoản cư dân"
        description={`Bạn đang khóa tài khoản của: ${lockingResident?.fullName}`}
        footer={
          <>
            <Button
              variant="outline"
              size="md"
              onClick={() => setLockingResident(null)}
              disabled={lockMutation.isPending}
            >
              Hủy
            </Button>
            <Button
              variant="destructive"
              size="md"
              onClick={handleConfirmLock}
              isLoading={lockMutation.isPending}
            >
              Xác nhận khóa tài khoản
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {lockError && (
            <Alert
              variant="error"
              message={lockError}
              onClose={() => setLockError(null)}
            />
          )}
          <Input
            label="Lý do khóa tài khoản (bắt buộc)"
            placeholder="Ví dụ: Đã chuyển đi nơi khác, vi phạm quy định..."
            value={lockReason}
            onChange={(e) => setLockReason(e.target.value)}
            required
            autoFocus
            helperText="Khóa tài khoản sẽ thu hồi toàn bộ phiên đăng nhập đang hoạt động của cư dân."
          />
        </div>
      </Modal>

      {/* Export Modal */}
      {exportModalDataset && (
        <ExportModal
          isOpen={Boolean(exportModalDataset)}
          onClose={() => setExportModalDataset(null)}
          dataset={exportModalDataset}
          title={`Xuất dữ liệu: ${
            exportModalDataset === ExportDataset.RESIDENTS
              ? 'Danh sách Cư dân'
              : exportModalDataset === ExportDataset.POLITICAL_SOCIAL
              ? 'Chính trị - Xã hội'
              : exportModalDataset === ExportDataset.ACTIVITIES
              ? 'Sổ hoạt động Khu phố'
              : 'Kiến nghị Cư dân'
          }`}
          filters={{ neighborhoodId: user.neighborhoodId || undefined }}
          filterSummary={[
            {
              label: 'Khu phố',
              value: user.neighborhood?.name || 'Khu phố trực thuộc',
            },
          ]}
        />
      )}
    </RoleWorkspace>
  );
}
