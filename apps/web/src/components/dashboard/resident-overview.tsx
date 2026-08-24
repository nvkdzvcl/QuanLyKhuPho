'use client';

import React, { useState } from 'react';
import {
  AnnouncementScope,
  PetitionStatus,
  type AnnouncementDto,
  type PetitionDto,
  type UserDto,
} from '@quanlykhupho/shared-types';
import { useAnnouncementFeed } from '../../hooks/use-announcements';
import { usePetitions } from '../../hooks/use-petitions';
import { useUnreadCount } from '../../hooks/use-notifications';
import { PetitionStatusBadge } from '../petitions/petition-status-badge';

interface ResidentOverviewProps {
  user: UserDto;
  onNavigateSection: (sectionId: string) => void;
}

type OverviewIconName = 'announcement' | 'petition' | 'response' | 'arrow' | 'calendar' | 'info';

function OverviewIcon({ name, className = 'h-5 w-5' }: { name: OverviewIconName; className?: string }) {
  const shared = { className, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  switch (name) {
    case 'announcement':
      return <svg {...shared}><path d="m3 11 18-5v12L3 14v-3Z" /><path d="M6 15.5 7.5 21h4l-1.2-4.4" /></svg>;
    case 'petition':
      return <svg {...shared}><path d="M6 2h9l5 5v15H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" /><path d="M14 2v6h6M9 13h6M9 17h4" /></svg>;
    case 'response':
      return <svg {...shared}><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z" /><path d="M8 9h8M8 13h5" /></svg>;
    case 'calendar':
      return <svg {...shared}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></svg>;
    case 'info':
      return <svg {...shared}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>;
    case 'arrow':
    default:
      return <svg {...shared}><path d="m9 18 6-6-6-6" /></svg>;
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
}

function getPetitionCode(id: string) {
  return `KN-${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

function AnnouncementRow({ item, onOpen }: { item: AnnouncementDto; onOpen: () => void }) {
  const isWard = item.scope === AnnouncementScope.WARD;
  return (
    <button type="button" onClick={onOpen} className="group flex w-full items-stretch overflow-hidden rounded-xl border border-slate-200 bg-white text-left transition hover:border-blue-200 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
      <span className={`relative flex w-24 shrink-0 items-center justify-center sm:w-28 ${isWard ? 'bg-gradient-to-br from-blue-100 via-blue-50 to-indigo-100 text-blue-600' : 'bg-gradient-to-br from-emerald-100 via-green-50 to-lime-100 text-emerald-600'}`}>
        <OverviewIcon name="announcement" className="h-9 w-9" />
        <span className="absolute left-2 top-2 rounded-md bg-red-500 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">Mới</span>
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-3 p-3 sm:p-4">
        <span className="min-w-0 flex-1">
          <span className="block line-clamp-2 text-sm font-bold leading-snug text-slate-950 group-hover:text-blue-700">{item.title}</span>
          <span className="mt-1 hidden line-clamp-2 text-xs leading-relaxed text-slate-500 sm:block">{item.content}</span>
          <span className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            <span>{formatDate(item.createdAt)}</span><span>•</span><span>{isWard ? 'Toàn phường' : item.neighborhood?.name || 'Khu phố'}</span>
          </span>
        </span>
        <OverviewIcon name="arrow" className="h-5 w-5 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-blue-600" />
      </span>
    </button>
  );
}

function PetitionRow({ item, onOpen }: { item: PetitionDto; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="w-full rounded-xl border border-slate-200 bg-white p-3.5 text-left transition hover:border-blue-200 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
      <span className="flex flex-wrap items-start justify-between gap-2">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-slate-950">{item.title}</span>
          <span className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            <span>Mã KN: {getPetitionCode(item.id)}</span><span>•</span><OverviewIcon name="calendar" className="h-3.5 w-3.5" /><span>{formatDate(item.createdAt)}</span>
          </span>
        </span>
        <PetitionStatusBadge status={item.status} className="shrink-0" />
      </span>
    </button>
  );
}

function PetitionTimeline({ petition }: { petition: PetitionDto }) {
  const reachedStep = petition.status === PetitionStatus.RESOLVED ? 3 : petition.status === PetitionStatus.PROCESSING ? 2 : 1;
  const isStopped = petition.status === PetitionStatus.REJECTED || petition.status === PetitionStatus.CANCELLED;
  const steps = [
    { number: 1, label: 'Tiếp nhận', detail: 'Kiến nghị đã được tiếp nhận' },
    { number: 2, label: 'Đang xử lý', detail: 'Đơn vị phụ trách đang xử lý' },
    { number: 3, label: 'Phản hồi', detail: 'Kết quả được gửi tới cư dân' },
  ];

  return (
    <div className="mt-5 border-t border-slate-100 pt-5">
      <p className="text-xs font-bold text-slate-800">Quy trình xử lý kiến nghị</p>
      <div className="relative mt-4 grid grid-cols-3 gap-2">
        <span className="absolute left-[16.66%] right-[16.66%] top-3 h-0.5 bg-slate-200" aria-hidden="true" />
        <span className="absolute left-[16.66%] top-3 h-0.5 bg-blue-600 transition-all" style={{ width: reachedStep === 3 ? '66.66%' : reachedStep === 2 ? '33.33%' : '0%' }} aria-hidden="true" />
        {steps.map((step) => {
          const reached = step.number <= reachedStep;
          return (
            <div key={step.number} className="relative z-10 text-center">
              <span className={`mx-auto flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${reached ? 'bg-blue-600 text-white' : 'bg-slate-300 text-white'}`}>{step.number}</span>
              <span className="mt-2 block text-[11px] font-bold text-slate-900 sm:text-xs">{step.label}</span>
              <span className="mx-auto mt-1 hidden max-w-28 text-[10px] leading-snug text-slate-500 sm:block">{step.detail}</span>
            </div>
          );
        })}
      </div>
      <div className={`mt-5 flex items-start gap-2 rounded-xl border p-3 text-xs ${isStopped ? 'border-red-100 bg-red-50 text-red-800' : 'border-blue-100 bg-blue-50 text-blue-800'}`}>
        <OverviewIcon name="info" className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{isStopped ? `Kiến nghị này đã ${petition.status === PetitionStatus.REJECTED ? 'bị từ chối' : 'được hủy'}. Mở chi tiết để xem lý do.` : 'Bạn có thể xem chi tiết, phản hồi và toàn bộ lịch sử tại mục “Kiến nghị của tôi”.'}</span>
      </div>
    </div>
  );
}

export function ResidentOverview({ user, onNavigateSection }: ResidentOverviewProps) {
  const [scope, setScope] = useState<AnnouncementScope | undefined>(undefined);
  const { data: announcements, isLoading: isLoadingAnnouncements } = useAnnouncementFeed({ scope, page: 1, limit: 3 });
  const { data: petitions, isLoading: isLoadingPetitions } = usePetitions({ page: 1, limit: 2 });
  const { data: reviewing } = usePetitions({ status: PetitionStatus.REVIEWING, page: 1, limit: 1 });
  const { data: processing } = usePetitions({ status: PetitionStatus.PROCESSING, page: 1, limit: 1 });
  const { data: resolved } = usePetitions({ status: PetitionStatus.RESOLVED, page: 1, limit: 1 });
  const { data: unread } = useUnreadCount();
  const activePetitionCount = (reviewing?.total || 0) + (processing?.total || 0);
  const latestPetition = petitions?.items[0];

  const statCards = [
    { label: 'thông báo mới', value: unread?.unreadCount || 0, icon: 'announcement' as const, tone: 'bg-blue-50 text-blue-600', action: 'announcements' },
    { label: 'kiến nghị đang xử lý', value: activePetitionCount, icon: 'petition' as const, tone: 'bg-orange-50 text-orange-600', action: 'petitions' },
    { label: 'phản hồi đã nhận', value: resolved?.total || 0, icon: 'response' as const, tone: 'bg-emerald-50 text-emerald-600', action: 'petitions' },
  ];

  return (
    <div className="space-y-5 sm:space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-5 sm:p-6 lg:border-0 lg:bg-transparent lg:p-0" aria-labelledby="resident-welcome-heading">
        <div className="relative z-10 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 id="resident-welcome-heading" className="text-xl font-extrabold tracking-tight text-slate-950 sm:text-2xl lg:text-3xl">Xin chào, {user.fullName}!</h2>
            <p className="mt-1 text-sm text-slate-600">{user.neighborhood?.name || 'Khu phố'}{user.neighborhood?.ward ? ` · ${user.neighborhood.ward}` : ''}</p>
          </div>
          <button type="button" onClick={() => onNavigateSection('create-petition')} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">
            <OverviewIcon name="petition" className="h-5 w-5" />
            Gửi kiến nghị
          </button>
        </div>
        <svg className="pointer-events-none absolute -bottom-4 right-2 h-28 w-36 text-blue-100/70 lg:hidden" viewBox="0 0 180 120" fill="none" aria-hidden="true"><path d="M25 105V63l37-25 31 21 24-16 37 24v38" fill="currentColor" /><path d="M49 105V76h23v29M109 105V75h22v30M89 105V65h18v40" stroke="#60a5fa" strokeWidth="4" /><circle cx="145" cy="29" r="11" fill="#86efac" /><path d="M145 42v36" stroke="#34d399" strokeWidth="5" /></svg>
      </section>

      <section className="hidden grid-cols-1 gap-3 sm:grid sm:grid-cols-3 sm:gap-4" aria-label="Chỉ số của Cư dân">
        {statCards.map((card) => (
          <button key={card.label} type="button" onClick={() => onNavigateSection(card.action)} className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 sm:p-5">
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${card.tone}`}><OverviewIcon name={card.icon} className="h-6 w-6" /></span>
            <span className="min-w-0 flex-1"><span className="block text-2xl font-extrabold text-slate-950">{card.value}</span><span className="block text-xs text-slate-600 sm:text-sm">{card.label}</span><span className="mt-2 hidden items-center gap-1 text-xs font-semibold text-blue-600 lg:flex">Xem chi tiết <OverviewIcon name="arrow" className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" /></span></span>
          </button>
        ))}
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-labelledby="latest-announcements-heading">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 id="latest-announcements-heading" className="text-lg font-extrabold text-slate-950">Thông báo mới nhất</h3>
            <div className="flex items-center gap-1.5" aria-label="Lọc thông báo">
              {[
                { value: undefined, label: 'Tất cả' },
                { value: AnnouncementScope.NEIGHBORHOOD, label: 'Khu phố' },
                { value: AnnouncementScope.WARD, label: 'Phường' },
              ].map((option) => (
                <button key={option.label} type="button" onClick={() => setScope(option.value)} className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${scope === option.value ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>{option.label}</button>
              ))}
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {isLoadingAnnouncements ? (
              <div className="space-y-3" aria-label="Đang tải thông báo">{[1, 2, 3].map((item) => <div key={item} className="h-24 animate-pulse rounded-xl bg-slate-100" />)}</div>
            ) : announcements?.items.length ? (
              announcements.items.map((item) => <AnnouncementRow key={item.id} item={item} onOpen={() => onNavigateSection('announcements')} />)
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">Chưa có thông báo trong phạm vi đã chọn.</div>
            )}
          </div>

          <button type="button" onClick={() => onNavigateSection('announcements')} className="mx-auto mt-4 flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800">Xem tất cả thông báo <OverviewIcon name="arrow" className="h-4 w-4" /></button>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-labelledby="resident-petitions-heading">
          <div className="flex items-center justify-between gap-3">
            <h3 id="resident-petitions-heading" className="text-lg font-extrabold text-slate-950">Kiến nghị của tôi</h3>
            <button type="button" onClick={() => onNavigateSection('petitions')} className="text-xs font-bold text-blue-600 hover:text-blue-800">Xem tất cả</button>
          </div>

          <div className="mt-4 space-y-3">
            {isLoadingPetitions ? (
              <div className="space-y-3" aria-label="Đang tải kiến nghị">{[1, 2].map((item) => <div key={item} className="h-20 animate-pulse rounded-xl bg-slate-100" />)}</div>
            ) : petitions?.items.length ? (
              petitions.items.map((item) => <PetitionRow key={item.id} item={item} onOpen={() => onNavigateSection('petitions')} />)
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 px-4 py-9 text-center"><p className="text-sm font-semibold text-slate-800">Bạn chưa gửi kiến nghị nào</p><button type="button" onClick={() => onNavigateSection('create-petition')} className="mt-2 text-xs font-bold text-blue-600">Gửi kiến nghị đầu tiên →</button></div>
            )}
          </div>

          {latestPetition && <PetitionTimeline petition={latestPetition} />}
        </section>
      </div>
    </div>
  );
}
