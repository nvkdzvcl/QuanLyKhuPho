'use client';

import React from 'react';
import type { UserDto } from '@quanlykhupho/shared-types';
import {
  getDeploymentBrand,
  useDeploymentProfile,
} from '../../hooks/use-deployment-profile';
import { AccountMenu } from '../shell/account-menu';
import { NotificationBell } from '../shell/notification-bell';
import type { NavigationItem } from './dashboard-navigation';

interface ResidentWorkspaceProps {
  user: UserDto;
  items: NavigationItem[];
  activeSection: string;
  onSectionChange: (sectionId: string) => void;
  children: React.ReactNode;
}

function ResidentNavIcon({ name, className = 'h-5 w-5' }: { name: NavigationItem['iconName']; className?: string }) {
  const shared = { className, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };

  switch (name) {
    case 'overview':
      return <svg {...shared}><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9" /><path d="M9 20v-7h6v7" /></svg>;
    case 'megaphone':
      return <svg {...shared}><path d="m3 11 18-5v12L3 14v-3Z" /><path d="M6 15.5 7.5 21h4l-1.2-4.4" /></svg>;
    case 'plus-square':
      return <svg {...shared}><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M12 8v8M8 12h8" /></svg>;
    case 'file-text':
      return <svg {...shared}><path d="M6 2h9l5 5v15H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" /><path d="M14 2v6h6M8 13h8M8 17h6" /></svg>;
    case 'account':
    case 'users':
      return <svg {...shared}><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v2" /></svg>;
    default:
      return <svg {...shared}><circle cx="12" cy="12" r="9" /><path d="M8 12h8" /></svg>;
  }
}

function BrandIcon({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m3 10 9-7 9 7" />
      <path d="M5 9v11h14V9" />
      <path d="M9 20v-7h6v7" />
    </svg>
  );
}

export function ResidentWorkspace({ user, items, activeSection, onSectionChange, children }: ResidentWorkspaceProps) {
  const { data: deploymentData } = useDeploymentProfile();
  const brandName = getDeploymentBrand(deploymentData?.profile);

  const activeItem = items.find((item) => item.id === activeSection) ?? items[0];
  const mobileItems = items.filter((item) => item.id !== 'create-petition');
  const mobileActiveSection = activeSection === 'create-petition' ? 'petitions' : activeSection;

  return (
    <div className="min-h-screen bg-[#f7f8fb] text-slate-950 lg:flex">
      <aside className="hidden min-h-screen w-64 shrink-0 flex-col bg-gradient-to-b from-[#0b3f9c] via-[#0752bd] to-[#073a89] text-white shadow-xl lg:flex">
        <div className="flex h-[76px] items-center gap-3 border-b border-white/10 px-6">
          <BrandIcon />
          <span className="text-base font-bold tracking-tight truncate">{brandName}</span>
        </div>

        <nav aria-label="Điều hướng Cư dân" className="flex-1 space-y-2 px-3 py-7">
          {items.map((item) => {
            const isActive = item.id === activeSection;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSectionChange(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-left text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white ${isActive ? 'bg-blue-500/80 text-white shadow-lg shadow-blue-950/20' : 'text-blue-50 hover:bg-white/10'}`}
              >
                <ResidentNavIcon name={item.iconName} className="h-5 w-5 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{item.shortLabel || item.label}</span>
                {item.badge && item.badge.count > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {item.badge.count > 9 ? '9+' : item.badge.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4">
          <AccountMenu
            user={user}
            subtitle={`Cư dân · ${user.neighborhood?.name || 'Khu phố'}`}
            variant="dark"
            onNavigateToAccount={() => onSectionChange('account')}
          />
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex min-h-[68px] items-center justify-between gap-3 px-4 sm:px-6 lg:min-h-[76px] lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-700 text-white lg:hidden"><BrandIcon className="h-6 w-6" /></span>
              <h1 className="truncate text-base font-bold tracking-tight text-slate-950 sm:text-xl lg:text-2xl">
                <span className="lg:hidden">{user.neighborhood?.name || 'Khu phố'}</span>
                <span className="hidden lg:inline">{activeItem?.label || 'Trang chủ Cư dân'}</span>
              </h1>
            </div>

            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <NotificationBell currentUser={user} />
              <div className="hidden items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 sm:flex">
                <ResidentNavIcon name="account" className="h-4 w-4" />
                <span>Cư dân</span>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1500px] p-4 pb-28 sm:p-6 sm:pb-28 lg:p-8 lg:pb-10">
          <section aria-label={activeItem?.label || 'Trang chủ Cư dân'}>{children}</section>
        </main>
      </div>

      <nav aria-label="Điều hướng Cư dân trên điện thoại" className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-4 gap-1">
          {mobileItems.map((item) => {
            const isActive = item.id === mobileActiveSection;
            const mobileLabel = item.id === 'petitions' ? 'Kiến nghị' : item.shortLabel || item.label;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSectionChange(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-[11px] font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${isActive ? 'text-blue-600' : 'text-slate-600'}`}
              >
                <ResidentNavIcon name={item.iconName} className="h-5 w-5" />
                <span className="w-full truncate text-center">{mobileLabel}</span>
                {item.badge && item.badge.count > 0 && (
                  <span className="absolute right-[calc(50%-18px)] top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">{item.badge.count > 9 ? '9+' : item.badge.count}</span>
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
