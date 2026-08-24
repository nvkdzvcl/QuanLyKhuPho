'use client';

import React from 'react';
import { Alert, Badge, Button } from '@quanlykhupho/ui';
import { PetitionCategory, type WardOverviewDto } from '@quanlykhupho/shared-types';
import { usePetitionCategoryAnalytics } from '../../hooks/use-dashboard';
import { getErrorMessage } from '../../lib/api-client';

export interface OfficerOverviewProps {
  overview?: WardOverviewDto;
  fallbackNeighborhoodCount: number;
  pendingResidentsCount: number;
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  onRetry: () => void;
  onNavigateSection: (sectionId: string) => void;
}

type MetricIconName = 'home' | 'users' | 'message' | 'document';

function MetricIcon({ name }: { name: MetricIconName }) {
  const shared = { className: 'h-6 w-6', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  if (name === 'home') return <svg {...shared}><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9M9 20v-7h6v7" /></svg>;
  if (name === 'users') return <svg {...shared}><circle cx="8" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M2 20v-2a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v2M14 14h3a5 5 0 0 1 5 5v1" /></svg>;
  if (name === 'message') return <svg {...shared}><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z" /><path d="M8 10h8M8 14h5" /></svg>;
  return <svg {...shared}><path d="M6 2h9l5 5v15H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" /><path d="M14 2v6h6M8 13h8M8 17h5" /></svg>;
}

function MetricCard({ label, value, icon, onClick }: { label: string; value: string | number; icon: MetricIconName; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="group min-h-36 rounded-xl border border-slate-200 bg-white p-5 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition group-hover:bg-blue-100"><MetricIcon name={icon} /></span>
      <span className="mt-5 block text-3xl font-bold leading-none text-slate-950 tabular-nums">{value}</span>
      <span className="mt-2 block text-sm font-medium text-slate-600">{label}</span>
    </button>
  );
}

const CATEGORY_LABELS: Record<PetitionCategory, string> = {
  [PetitionCategory.SANITATION]: 'Vệ sinh môi trường',
  [PetitionCategory.INFRASTRUCTURE]: 'Hệ thống hạ tầng',
  [PetitionCategory.SECURITY]: 'An ninh trật tự',
  [PetitionCategory.OTHER]: 'Khác',
};

const CATEGORY_COLORS: Record<PetitionCategory, string> = {
  [PetitionCategory.SANITATION]: '#2563eb',
  [PetitionCategory.INFRASTRUCTURE]: '#16a34a',
  [PetitionCategory.SECURITY]: '#f59e0b',
  [PetitionCategory.OTHER]: '#6d28d9',
};

function buildDonutGradient(series: Array<{ category: PetitionCategory; percentage: number }>) {
  if (series.every((item) => item.percentage === 0)) return '#e2e8f0';
  let cursor = 0;
  const stops = series.map((item) => {
    const start = cursor;
    cursor += item.percentage;
    return `${CATEGORY_COLORS[item.category]} ${start}% ${cursor}%`;
  });
  return `conic-gradient(${stops.join(', ')})`;
}

function getNeighborhoodStatus(pendingResidents: number, pendingPetitions: number) {
  const attentionScore = pendingResidents + pendingPetitions;
  if (attentionScore === 0) return { label: 'Đang tốt', variant: 'success' as const };
  if (attentionScore <= 3) return { label: 'Trung bình', variant: 'warning' as const };
  return { label: 'Cần chú ý', variant: 'destructive' as const };
}

export function OfficerOverview({ overview, fallbackNeighborhoodCount, pendingResidentsCount, isLoading, isError, error, onRetry, onNavigateSection }: OfficerOverviewProps) {
  const { data: categoryAnalytics, isLoading: isLoadingCategories } = usePetitionCategoryAnalytics();
  const categorySeries = categoryAnalytics?.series ?? [];
  const donutBackground = buildDonutGradient(categorySeries);

  if (isError) {
    return <Alert variant="error" message={getErrorMessage(error) || 'Không thể tải số liệu tổng quan toàn phường.'} action={<Button variant="outline" size="sm" onClick={onRetry}>Thử lại</Button>} />;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="khu phố" value={isLoading ? '…' : overview?.neighborhoodCount ?? fallbackNeighborhoodCount} icon="home" onClick={() => onNavigateSection('analytics')} />
        <MetricCard label="cư dân" value={isLoading ? '…' : (overview?.residentCount ?? 0).toLocaleString('vi-VN')} icon="users" onClick={() => onNavigateSection('resident-profiles')} />
        <MetricCard label="kiến nghị" value={isLoading ? '…' : overview?.petitionsByStatus.total ?? 0} icon="message" onClick={() => onNavigateSection('petitions')} />
        <MetricCard label="hồ sơ chờ duyệt" value={isLoading ? '…' : pendingResidentsCount} icon="document" onClick={() => onNavigateSection('pending-residents')} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-6">
          <h2 className="text-base font-bold text-slate-950">Kiến nghị theo danh mục</h2>
          <div className="mt-6 flex flex-col items-center gap-6 sm:flex-row sm:items-center">
            <div className="relative h-44 w-44 shrink-0 rounded-full" style={{ background: donutBackground }}>
              <div className="absolute inset-7 flex flex-col items-center justify-center rounded-full bg-white"><span className="text-2xl font-bold text-slate-950">{isLoadingCategories ? '…' : categoryAnalytics?.total ?? 0}</span><span className="text-xs text-slate-500">tổng số</span></div>
            </div>
            <div className="w-full space-y-3">
              {categorySeries.length === 0 && !isLoadingCategories ? <p className="text-sm text-slate-500">Chưa có dữ liệu kiến nghị.</p> : categorySeries.map((item) => (
                <div key={item.category} className="flex items-center gap-2 text-xs"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[item.category] }} /><span className="min-w-0 flex-1 truncate text-slate-600">{CATEGORY_LABELS[item.category]}</span><span className="font-semibold text-slate-950">{item.count}</span><span className="w-12 text-right text-slate-400">{item.percentage.toFixed(1)}%</span></div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-6">
          <h2 className="text-base font-bold text-slate-950">Tiến độ xử lý theo khu phố</h2>
          <div className="mt-6 space-y-5">
            {isLoading ? <p className="text-sm text-slate-500">Đang tổng hợp tiến độ...</p> : !overview || overview.neighborhoodSummaries.length === 0 ? <p className="text-sm text-slate-500">Chưa có dữ liệu khu phố.</p> : overview.neighborhoodSummaries.slice(0, 6).map((neighborhood) => {
              const progress = neighborhood.totalPetitionsCount > 0 ? Math.round((neighborhood.resolvedPetitionsCount / neighborhood.totalPetitionsCount) * 100) : 100;
              return <div key={neighborhood.id} className="grid grid-cols-[88px_1fr_42px] items-center gap-3 text-xs"><span className="truncate font-medium text-slate-700">{neighborhood.name}</span><span className="h-2.5 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-blue-600" style={{ width: `${progress}%` }} /></span><span className="text-right font-semibold tabular-nums text-slate-700">{progress}%</span></div>;
            })}
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="border-b border-slate-200 px-5 py-4 sm:px-6"><h2 className="text-lg font-bold text-slate-950">Tình hình các khu phố</h2><p className="mt-1 text-xs text-slate-500">Dữ liệu vận hành tổng hợp theo từng địa bàn</p></div>
        {isLoading ? <div className="p-10 text-center text-sm text-slate-500">Đang tải tình hình khu phố...</div> : !overview || overview.neighborhoodSummaries.length === 0 ? <div className="p-10 text-center text-sm text-slate-500">Chưa có khu phố nào trong hệ thống.</div> : (
          <div className="overflow-x-auto"><table className="min-w-[900px] w-full text-left text-sm"><thead className="bg-slate-50 text-xs font-semibold text-slate-600"><tr><th className="px-6 py-3">Khu phố</th><th className="px-4 py-3 text-right">Cư dân</th><th className="px-4 py-3 text-right">Kiến nghị</th><th className="px-4 py-3 text-right">Hồ sơ chờ duyệt</th><th className="px-4 py-3 text-right">Thông báo đã đăng</th><th className="px-6 py-3 text-center">Tình trạng</th></tr></thead><tbody className="divide-y divide-slate-100">
            {overview.neighborhoodSummaries.map((neighborhood) => { const status = getNeighborhoodStatus(neighborhood.pendingResidentCount, neighborhood.pendingPetitionsCount); return <tr key={neighborhood.id} className="hover:bg-slate-50/70"><td className="px-6 py-4 font-semibold text-slate-950">{neighborhood.name}</td><td className="px-4 py-4 text-right tabular-nums">{neighborhood.residentCount.toLocaleString('vi-VN')}</td><td className="px-4 py-4 text-right tabular-nums">{neighborhood.totalPetitionsCount}</td><td className="px-4 py-4 text-right tabular-nums">{neighborhood.pendingResidentCount}</td><td className="px-4 py-4 text-right tabular-nums">{neighborhood.publishedAnnouncementsCount}</td><td className="px-6 py-4 text-center"><Badge variant={status.variant}>{status.label}</Badge></td></tr>; })}
          </tbody></table></div>
        )}
        <button type="button" onClick={() => onNavigateSection('analytics')} className="w-full border-t border-slate-100 py-4 text-sm font-medium text-blue-600 hover:bg-blue-50/50">Xem tất cả khu phố <span aria-hidden="true">→</span></button>
      </section>
    </div>
  );
}
