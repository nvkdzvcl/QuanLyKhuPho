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
import { UserDto, UserRole } from '@quanlykhupho/shared-types';
import { useNeighborhoods } from '../../hooks/use-neighborhoods';
import {
  useCreateLeader,
  usePendingResidents,
} from '../../hooks/use-pending-residents';
import { useWardOverview } from '../../hooks/use-dashboard';
import { getErrorMessage } from '../../lib/api-client';
import { useDeploymentProfile } from '../../hooks/use-deployment-profile';

import {
  getOfficerNavigationItems,
  normalizeSectionForRole,
} from './dashboard-navigation';
import { RoleWorkspace } from './role-workspace';
import { OfficerOverview } from './officer-overview';
import { AnnouncementFeed } from '../announcements/announcement-feed';
import { PetitionList } from '../petitions/petition-list';
import { ResidentProfileManagement } from '../resident-profiles/resident-profile-management';
import { PoliticalSocialManagement } from '../political-social-profiles/political-social-management';
import {
  ActivityCreationSeed,
  NeighborhoodActivityManagement,
} from '../neighborhood-activities/neighborhood-activity-management';
import { WardOverviewStats } from './ward-overview-stats';
import { PeriodicReportCard } from './periodic-report-card';

interface OfficerViewProps {
  user: UserDto;
}

export function OfficerView({ user }: OfficerViewProps) {
  const { data: deploymentData } = useDeploymentProfile();
  const localityName = deploymentData?.profile?.localityName;
  const [activeSection, setActiveSection] = useState<string>('overview');
  const [activityCreationSeed, setActivityCreationSeed] =
    useState<ActivityCreationSeed | null>(null);
  const [selectedNeighborhoodId, setSelectedNeighborhoodId] =
    useState<string>('');

  const { data: neighborhoods = [], isLoading: isLoadingNeighborhoods } =
    useNeighborhoods();

  const {
    data: wardOverview,
    isLoading: isLoadingOverview,
    isError: isErrorOverview,
    error: overviewError,
    refetch: refetchOverview,
  } = useWardOverview();

  const {
    data: pendingResidents = [],
    isLoading: isLoadingPending,
    isError: isErrorPending,
    error: pendingError,
    refetch: refetchPending,
  } = usePendingResidents();

  const createLeaderMutation = useCreateLeader();

  // Create Leader Modal state
  const [isCreateLeaderOpen, setIsCreateLeaderOpen] = useState(false);
  const [leaderPhone, setLeaderPhone] = useState('');
  const [leaderFullName, setLeaderFullName] = useState('');
  const [leaderNeighborhoodId, setLeaderNeighborhoodId] = useState('');
  const [leaderAddress, setLeaderAddress] = useState('');
  const [createLeaderError, setCreateLeaderError] = useState<string | null>(
    null,
  );
  const [toastFeedback, setToastFeedback] = useState<{
    variant: 'success' | 'error';
    message: string;
  } | null>(null);

  const handleOpenCreateLeader = (preselectedNeighborhoodId?: string) => {
    setLeaderPhone('');
    setLeaderFullName('');
    setLeaderNeighborhoodId(preselectedNeighborhoodId || '');
    setLeaderAddress('');
    setCreateLeaderError(null);
    setIsCreateLeaderOpen(true);
  };

  const handleCreateLeader = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLeaderError(null);

    if (!leaderPhone.trim()) {
      setCreateLeaderError('Vui lòng nhập số điện thoại Trưởng khu phố');
      return;
    }
    if (!leaderFullName.trim()) {
      setCreateLeaderError('Vui lòng nhập họ và tên');
      return;
    }
    if (!leaderNeighborhoodId) {
      setCreateLeaderError('Vui lòng chọn khu phố quản lý');
      return;
    }

    try {
      const created = await createLeaderMutation.mutateAsync({
        phoneNumber: leaderPhone.trim(),
        fullName: leaderFullName.trim(),
        neighborhoodId: leaderNeighborhoodId,
        address: leaderAddress.trim() || undefined,
      });

      setToastFeedback({
        variant: 'success',
        message: `Đã khởi tạo Trưởng khu phố "${created.fullName}" thành công. Tài khoản có hiệu lực ngay lập tức.`,
      });
      setIsCreateLeaderOpen(false);
      setLeaderPhone('');
      setLeaderFullName('');
      setLeaderNeighborhoodId('');
      setLeaderAddress('');
    } catch (err) {
      setCreateLeaderError(getErrorMessage(err));
    }
  };

  const neighborhoodOptions = neighborhoods.map((n) => ({
    value: n.id,
    label: `${n.name} (${n.code}) - ${n.ward}`,
  }));

  const currentSection = normalizeSectionForRole(
    UserRole.OFFICER,
    activeSection,
  );

  const navItems = getOfficerNavigationItems({
    pendingResidentsCount: pendingResidents.length,
  });

  // Filter pending residents if filtered by neighborhood in oversight view
  const displayedPendingResidents = selectedNeighborhoodId
    ? pendingResidents.filter(
        (r) =>
          r.neighborhoodId === selectedNeighborhoodId ||
          r.neighborhood?.id === selectedNeighborhoodId,
      )
    : pendingResidents;

  return (
    <RoleWorkspace
      user={user}
      title={localityName ? `Tổng quan ${localityName}` : 'Tổng quan địa bàn'}
      subtitle={
        <span>
          Cán bộ: <strong>{user.fullName}</strong> ({user.maskedPhone}) • Phân quyền {localityName ?? 'cấp địa bàn'}
        </span>
      }
      badgeText="Cán bộ địa phương"
      accentColor="blue"
      ariaLabel="Điều hướng quản trị địa bàn"
      items={navItems}
      activeSection={currentSection}
      onSectionChange={setActiveSection}
      headerActions={
        <Button
          variant="primary"
          size="sm"
          onClick={() => handleOpenCreateLeader()}
          className="hidden bg-blue-600 text-xs font-semibold shadow-sm hover:bg-blue-700 sm:inline-flex"
        >
          + Bổ nhiệm Tổ trưởng
        </Button>
      }
    >
      {/* Toast Feedback */}
      {toastFeedback && (
        <Alert
          variant={toastFeedback.variant}
          message={toastFeedback.message}
          onClose={() => setToastFeedback(null)}
        />
      )}

      {/* Section 1: Overview */}
      {currentSection === 'overview' && (
        <OfficerOverview
          overview={wardOverview}
          fallbackNeighborhoodCount={neighborhoods.length}
          pendingResidentsCount={pendingResidents.length}
          isLoading={isLoadingOverview}
          isError={isErrorOverview}
          error={overviewError}
          onRetry={() => refetchOverview()}
          onNavigateSection={setActiveSection}
        />
      )}

      {/* Section 2: Ward Overview & Neighborhood Analytics Drill-down */}
      {currentSection === 'analytics' && <WardOverviewStats />}

      {/* Section 3: Leaders Management */}
      {currentSection === 'leaders' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle>Quản lý Nhân sự Trưởng Khu Phố</CardTitle>
                  <CardDescription>
                    Danh sách các khu phố trực thuộc và phân công Trưởng khu phố phụ trách
                  </CardDescription>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleOpenCreateLeader()}
                  className="font-semibold shadow-sm text-xs sm:text-sm self-start sm:self-auto"
                >
                  + Bổ nhiệm Trưởng khu phố
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Policy & Guidance */}
              <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4 text-xs text-blue-900 space-y-2">
                <h5 className="font-bold text-blue-950 flex items-center gap-1.5">
                  <span>📋</span>
                  <span>Quy định phân quyền và bổ nhiệm:</span>
                </h5>
                <ul className="list-disc list-inside space-y-1 text-blue-800">
                  <li>
                    <strong>Thẩm quyền cán bộ phường:</strong> Khởi tạo tài khoản Trưởng khu phố và phân công phụ trách khu phố tương ứng.
                  </li>
                  <li>
                    <strong>Trách nhiệm Trưởng khu phố (SRS FR-03):</strong> Trực tiếp xét duyệt hoặc từ chối hồ sơ cư dân đăng ký vào khu phố, quản lý sổ hoạt động và phát hành thông báo nội bộ.
                  </li>
                  <li>
                    <strong>Kích hoạt:</strong> Tài khoản Trưởng khu phố sau khi tạo sẽ có hiệu lực đăng nhập OTP ngay lập tức.
                  </li>
                </ul>
              </div>

              {/* Neighborhoods and Leader assignment cards */}
              <div>
                <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-3">
                  Danh sách Địa bàn Khu phố ({neighborhoods.length} đơn vị)
                </h4>

                {isLoadingNeighborhoods ? (
                  <div className="py-10 text-center text-sm text-slate-500">
                    Đang tải danh sách khu phố...
                  </div>
                ) : neighborhoods.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
                    Chưa có khu phố nào được cấu hình trong hệ thống.
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {neighborhoods.map((n) => (
                      <div
                        key={n.id}
                        className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50/50 p-4 transition hover:bg-white hover:shadow-sm"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-md">
                              {n.code}
                            </span>
                            <Badge variant="info">{n.ward}</Badge>
                          </div>
                          <div>
                            <h4 className="text-base font-bold text-slate-900">
                              {n.name}
                            </h4>
                            <p className="text-xs text-slate-500">
                              {n.district}, {n.city}
                            </p>
                          </div>
                          {n.description && (
                            <p className="text-xs text-slate-600 line-clamp-2">
                              {n.description}
                            </p>
                          )}
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-200/80 flex items-center justify-between gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenCreateLeader(n.id)}
                            className="w-full text-xs font-semibold text-blue-900 hover:bg-blue-50"
                          >
                            + Bổ nhiệm Trưởng KP
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Section 4: Periodic Reports (FR-20) */}
      {currentSection === 'reports' && <PeriodicReportCard />}

      {/* Section 5: Announcements Feed */}
      {currentSection === 'announcements' && <AnnouncementFeed user={user} />}

      {/* Section 6: Petitions List */}
      {currentSection === 'petitions' && <PetitionList user={user} />}

      {/* Section 7: Resident Profiles */}
      {currentSection === 'resident-profiles' && (
        <ResidentProfileManagement
          user={user}
          onSeedActivity={(seed) => {
            setActivityCreationSeed(seed);
            setActiveSection('activities');
          }}
        />
      )}

      {/* Section 8: Political & Social Profiles */}
      {currentSection === 'political-social' && (
        <PoliticalSocialManagement user={user} />
      )}

      {/* Section 9: Neighborhood Activities */}
      {currentSection === 'activities' && (
        <NeighborhoodActivityManagement
          user={user}
          creationSeed={activityCreationSeed}
          onCreationSeedConsumed={() => setActivityCreationSeed(null)}
        />
      )}

      {/* Section 10: Ward Oversight & Pending Queue (Read-Only) */}
      {currentSection === 'pending-residents' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle>Hồ sơ Đăng ký chờ duyệt trên địa bàn</CardTitle>
                    <Badge
                      variant={
                        displayedPendingResidents.length > 0 ? 'info' : 'success'
                      }
                    >
                      {displayedPendingResidents.length} hồ sơ
                    </Badge>
                  </div>
                  <CardDescription className="mt-0.5">
                    Giám sát tiến độ xét duyệt cư dân của các Trưởng khu phố toàn phường
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label="Lọc theo khu phố"
                    value={selectedNeighborhoodId}
                    onChange={(e) => setSelectedNeighborhoodId(e.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 shadow-sm focus:border-blue-600 focus:outline-none"
                  >
                    <option value="">Tất cả các khu phố</option>
                    {neighborhoods.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.name} ({n.code})
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchPending()}
                    className="text-xs"
                  >
                    Làm mới
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* SRS FR-03 Read-Only Oversight Notice */}
              <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 text-xs text-blue-900 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-blue-950">
                  <span>ℹ️</span>
                  <span>Chế độ Giám sát Cán bộ Phường (Oversight Mode):</span>
                </div>
                <p className="text-blue-800 leading-relaxed">
                  Theo quy định phân quyền chuẩn của hệ thống (SRS FR-03), quyền phê duyệt và từ chối hồ sơ đăng ký cư dân thuộc thẩm quyền trực tiếp của Trưởng khu phố phụ trách địa bàn. Màn hình này hỗ trợ Cán bộ phường theo dõi số lượng và đôn đốc tiến độ xử lý của từng khu phố.
                </p>
              </div>

              {isLoadingPending ? (
                <div className="py-12 text-center text-sm text-slate-500">
                  Đang tải danh sách hồ sơ...
                </div>
              ) : isErrorPending ? (
                <Alert
                  variant="error"
                  message={
                    getErrorMessage(pendingError) ||
                    'Không thể tải danh sách hồ sơ chờ duyệt.'
                  }
                  action={
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => refetchPending()}
                    >
                      Thử lại
                    </Button>
                  }
                />
              ) : displayedPendingResidents.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 text-xl font-bold mb-2">
                    ✓
                  </div>
                  <h4 className="font-bold text-slate-900">
                    Không có hồ sơ cư dân nào đang chờ duyệt
                  </h4>
                  <p className="mt-1 text-xs text-slate-500">
                    {selectedNeighborhoodId
                      ? 'Khu phố đã chọn không có hồ sơ nào đang chờ duyệt.'
                      : 'Tất cả hồ sơ đăng ký trên toàn phường đã được các Trưởng khu phố xử lý.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {displayedPendingResidents.map((res) => (
                    <div
                      key={res.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 transition hover:bg-white hover:shadow-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-slate-900">
                            {res.fullName}
                          </span>
                          <Badge variant="info">
                            {res.neighborhood?.name || 'Khu phố'}
                          </Badge>
                          <Badge variant="warning">Chờ Trưởng KP duyệt</Badge>
                        </div>
                        <p className="text-xs text-slate-600">
                          <strong>SĐT:</strong>{' '}
                          <span className="font-mono">{res.maskedPhone}</span> •{' '}
                          <strong>Địa chỉ:</strong>{' '}
                          {res.address || 'Chưa cập nhật'}
                        </p>
                      </div>
                      <div className="text-xs text-slate-400 shrink-0">
                        Đăng ký lúc:{' '}
                        {new Date(res.createdAt).toLocaleString('vi-VN')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Create Leader Modal */}
      <Modal
        isOpen={isCreateLeaderOpen}
        onClose={() => setIsCreateLeaderOpen(false)}
        title="Bổ nhiệm Trưởng khu phố mới"
        description="Khởi tạo tài khoản quản trị Trưởng khu phố. Tài khoản sẽ được kích hoạt ngay lập tức."
        maxWidth="lg"
      >
        <form onSubmit={handleCreateLeader} className="space-y-4">
          {createLeaderError && (
            <Alert
              variant="error"
              message={createLeaderError}
              onClose={() => setCreateLeaderError(null)}
            />
          )}

          <Input
            label="Số điện thoại di động (10 số)"
            placeholder="Ví dụ: 0987654321"
            value={leaderPhone}
            onChange={(e) => setLeaderPhone(e.target.value)}
            required
            helperText="Dùng để đăng nhập OTP an toàn"
          />

          <Input
            label="Họ và tên Trưởng khu phố"
            placeholder="Ví dụ: Trần Văn B"
            value={leaderFullName}
            onChange={(e) => setLeaderFullName(e.target.value)}
            required
          />

          <Select
            label="Khu phố phụ trách"
            placeholder="-- Chọn khu phố quản lý --"
            options={neighborhoodOptions}
            value={leaderNeighborhoodId}
            onChange={(e) => setLeaderNeighborhoodId(e.target.value)}
            required
          />

          <Input
            label="Địa chỉ nơi ở (tùy chọn)"
            placeholder="Địa chỉ liên hệ"
            value={leaderAddress}
            onChange={(e) => setLeaderAddress(e.target.value)}
          />

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setIsCreateLeaderOpen(false)}
              disabled={createLeaderMutation.isPending}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={createLeaderMutation.isPending}
            >
              Tạo tài khoản Trưởng khu phố
            </Button>
          </div>
        </form>
      </Modal>
    </RoleWorkspace>
  );
}
