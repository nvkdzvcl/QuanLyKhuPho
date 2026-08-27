'use client';

import React from 'react';
import { Alert, Badge, Button } from '@quanlykhupho/ui';
import { PetitionStatus, type UserDto } from '@quanlykhupho/shared-types';
import { useMonthlyNeighborhoodActivities } from '../../hooks/use-neighborhood-activities';
import { usePetitions } from '../../hooks/use-petitions';
import { useResidentProfiles } from '../../hooks/use-resident-profiles';
import { getErrorMessage } from '../../lib/api-client';
import { AppIcon } from '../app-icon';

export interface LeaderOverviewProps {
  user: UserDto;
  pendingResidents: UserDto[];
  isLoadingPending: boolean;
  isErrorPending: boolean;
  pendingError?: unknown;
  onApproveResident: (resident: UserDto) => void;
  onOpenRejectModal: (resident: UserDto) => void;
  isApproving?: boolean;
  onNavigateSection: (sectionId: string) => void;
}

type MetricIconName = 'document' | 'message' | 'users' | 'calendar';

function MetricIcon({ name }: { name: MetricIconName }) {
  const shared = {
    className: 'h-6 w-6',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  if (name === 'document') {
    return <svg {...shared}><path d="M6 2h9l5 5v15H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" /><path d="M14 2v6h6M8 13h8M8 17h5" /></svg>;
  }
  if (name === 'message') {
    return <svg {...shared}><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z" /><path d="M8 10h8M8 14h5" /></svg>;
  }
  if (name === 'users') {
    return <svg {...shared}><circle cx="8" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M2 20v-2a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v2M14 14h3a5 5 0 0 1 5 5v1" /></svg>;
  }
  return <svg {...shared}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01" /></svg>;
}

function MetricCard({ label, value, caption, icon, onClick }: { label: string; value: string | number; caption: string; icon: MetricIconName; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="group min-h-40 rounded-xl border border-slate-200 bg-white p-5 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600 transition group-hover:bg-amber-100"><MetricIcon name={icon} /></span>
      <span className="mt-5 block text-3xl font-bold leading-none text-slate-950 tabular-nums">{value}</span>
      <span className="mt-2 block text-sm font-medium text-slate-700">{label}</span>
      <span className="mt-1 block text-xs text-slate-400">{caption}</span>
    </button>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

const PETITION_STATUS_LABELS: Record<PetitionStatus, string> = {
  [PetitionStatus.REVIEWING]: 'Mới',
  [PetitionStatus.PROCESSING]: 'Đang xử lý',
  [PetitionStatus.RESOLVED]: 'Đã xử lý',
  [PetitionStatus.REJECTED]: 'Từ chối',
  [PetitionStatus.CANCELLED]: 'Đã hủy',
};

export function LeaderOverview({ user, pendingResidents, isLoadingPending, isErrorPending, pendingError, onApproveResident, onOpenRejectModal, isApproving = false, onNavigateSection }: LeaderOverviewProps) {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const { data: petitionData, isLoading: isLoadingPetitions } = usePetitions({ neighborhoodId: user.neighborhoodId || undefined, limit: 5 });
  const { data: residentProfileData, isLoading: isLoadingProfiles } = useResidentProfiles({ neighborhoodId: user.neighborhoodId || undefined, limit: 1 }, { enabled: Boolean(user.neighborhoodId) });
  const { data: activityData, isLoading: isLoadingActivities } = useMonthlyNeighborhoodActivities({ month: currentMonth, neighborhoodId: user.neighborhoodId || undefined, limit: 5 });

  const pendingCount = pendingResidents.length;
  const petitionsCount = petitionData?.total ?? 0;
  const profilesCount = residentProfileData?.total ?? 0;
  const activitiesCount = activityData?.total ?? 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="hồ sơ chờ duyệt" value={isLoadingPending ? '…' : pendingCount} caption="Tài khoản cư dân mới" icon="document" onClick={() => onNavigateSection('moderation')} />
        <MetricCard label="kiến nghị mới" value={isLoadingPetitions ? '…' : petitionsCount} caption="Phản ánh trong khu phố" icon="message" onClick={() => onNavigateSection('petitions')} />
        <MetricCard label="cư dân" value={isLoadingProfiles ? '…' : profilesCount.toLocaleString('vi-VN')} caption="Hồ sơ nhân khẩu quản lý" icon="users" onClick={() => onNavigateSection('resident-profiles')} />
        <MetricCard label="hoạt động trong tháng" value={isLoadingActivities ? '…' : activitiesCount} caption="Sự kiện và phong trào" icon="calendar" onClick={() => onNavigateSection('activities')} />
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Công việc cần xử lý</h2>
            <p className="mt-1 text-xs text-slate-500">Hồ sơ đăng ký cư dân đang chờ xác minh</p>
          </div>
          <Badge variant={pendingCount > 0 ? 'warning' : 'success'}>{pendingCount} hồ sơ</Badge>
        </div>

        {isLoadingPending ? (
          <div className="p-10 text-center text-sm text-slate-500">Đang tải danh sách hồ sơ...</div>
        ) : isErrorPending ? (
          <div className="p-5"><Alert variant="error" message={getErrorMessage(pendingError) || 'Không thể tải danh sách hồ sơ chờ duyệt.'} /></div>
        ) : pendingResidents.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <AppIcon name="check" className="h-5 w-5" />
            </span>
            <h3 className="mt-3 text-sm font-semibold text-slate-900">Không có hồ sơ chờ xử lý</h3>
            <p className="mt-1 text-xs text-slate-500">Hồ sơ mới sẽ xuất hiện tại đây khi cư dân đăng ký.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[860px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
                <tr><th className="px-6 py-3">Họ và tên</th><th className="px-4 py-3">Loại hồ sơ</th><th className="px-4 py-3">Thời gian gửi</th><th className="px-4 py-3">Ghi chú</th><th className="px-6 py-3 text-right">Thao tác</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendingResidents.slice(0, 5).map((resident) => (
                  <tr key={resident.id} className="hover:bg-slate-50/70">
                    <td className="px-6 py-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 font-bold text-amber-700">{resident.fullName.charAt(0).toUpperCase()}</span><div><div className="font-semibold text-slate-950">{resident.fullName}</div><div className="mt-0.5 font-mono text-xs text-slate-500">{resident.maskedPhone}</div></div></div></td>
                    <td className="px-4 py-4 text-slate-700">Đăng ký cư trú</td>
                    <td className="px-4 py-4 text-slate-700"><div>{formatDate(resident.createdAt)}</div><div className="text-xs text-slate-400">{formatTime(resident.createdAt)}</div></td>
                    <td className="max-w-60 px-4 py-4 text-slate-600">{resident.address || 'Chưa cập nhật địa chỉ'}</td>
                    <td className="px-6 py-4"><div className="flex justify-end gap-2"><Button variant="primary" size="sm" onClick={() => onApproveResident(resident)} isLoading={isApproving} className="bg-emerald-600 text-xs hover:bg-emerald-700 flex items-center gap-1"><AppIcon name="check" className="h-3.5 w-3.5" /><span>Duyệt</span></Button><Button variant="outline" size="sm" onClick={() => onOpenRejectModal(resident)} className="border-red-300 text-xs text-red-600 hover:bg-red-50 flex items-center gap-1"><AppIcon name="x" className="h-3.5 w-3.5" /><span>Từ chối</span></Button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
          <div><h2 className="text-lg font-bold text-slate-950">Kiến nghị mới nhất</h2><p className="mt-1 text-xs text-slate-500">Các phản ánh vừa được gửi từ cư dân</p></div>
          <button type="button" onClick={() => onNavigateSection('petitions')} className="text-xs font-semibold text-blue-600 hover:text-blue-800">Xem tất cả</button>
        </div>
        {isLoadingPetitions ? (
          <div className="p-10 text-center text-sm text-slate-500">Đang tải kiến nghị...</div>
        ) : !petitionData || petitionData.items.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">Chưa có kiến nghị nào trong khu phố.</div>
        ) : (
          <div className="divide-y divide-slate-100 px-4 sm:px-6">
            {petitionData.items.slice(0, 3).map((petition) => (
              <button key={petition.id} type="button" onClick={() => onNavigateSection('petitions')} className="flex w-full items-center gap-4 py-4 text-left transition hover:bg-slate-50">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600"><MetricIcon name="message" /></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-950">{petition.title}</span><span className="mt-1 block truncate text-xs text-slate-500">{petition.author.fullName} • {petition.neighborhood?.name || user.neighborhood?.name}</span></span>
                <span className="shrink-0 text-right"><Badge variant={petition.status === PetitionStatus.RESOLVED ? 'success' : petition.status === PetitionStatus.PROCESSING ? 'info' : 'warning'}>{PETITION_STATUS_LABELS[petition.status]}</Badge><span className="mt-1 block text-[11px] text-slate-400">{formatDate(petition.createdAt)}</span></span>
              </button>
            ))}
          </div>
        )}
        <button type="button" onClick={() => onNavigateSection('petitions')} className="w-full border-t border-slate-100 py-4 text-sm font-medium text-blue-600 hover:bg-blue-50/50">Xem tất cả kiến nghị <span aria-hidden="true">→</span></button>
      </section>
    </div>
  );
}
