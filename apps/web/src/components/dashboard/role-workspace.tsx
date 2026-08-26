'use client';

import React from 'react';
import type { UserDto } from '@quanlykhupho/shared-types';
import { useAuth } from '../../lib/auth-context';
import {
  getDeploymentBrand,
  useDeploymentProfile,
} from '../../hooks/use-deployment-profile';
import { NotificationBell } from '../shell/notification-bell';
import type { NavigationItem } from './dashboard-navigation';

export type WorkspaceAccent = 'amber' | 'blue';

export interface RoleWorkspaceProps {
  user: UserDto;
  title: string;
  subtitle?: React.ReactNode;
  badgeText: string;
  accentColor?: WorkspaceAccent;
  items: NavigationItem[];
  activeSection: string;
  onSectionChange: (sectionId: string) => void;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
  ariaLabel?: string;
}

const ACCENT_STYLES = {
  amber: {
    brand: 'bg-gradient-to-br from-amber-600 to-orange-600',
    active: 'bg-amber-50 text-amber-700',
    activeIcon: 'text-amber-600',
    badge: 'bg-amber-100 text-amber-800',
    avatar: 'bg-amber-100 text-amber-700',
    profile: 'border-amber-200 hover:bg-amber-50/70',
    mobileActive: 'border-amber-500 bg-amber-50 text-amber-700',
  },
  blue: {
    brand: 'bg-gradient-to-br from-blue-800 to-blue-950',
    active: 'bg-blue-50 text-blue-700',
    activeIcon: 'text-blue-600',
    badge: 'bg-blue-100 text-blue-800',
    avatar: 'bg-blue-100 text-blue-700',
    profile: 'border-blue-200 hover:bg-blue-50/70',
    mobileActive: 'border-blue-500 bg-blue-50 text-blue-700',
  },
} as const;

function NavIcon({ name, className = 'h-5 w-5' }: { name: NavigationItem['iconName']; className?: string }) {
  const shared = { className, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };

  switch (name) {
    case 'overview':
      return <svg {...shared}><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9" /><path d="M9 20v-7h6v7" /></svg>;
    case 'user-check':
      return <svg {...shared}><circle cx="9" cy="7" r="4" /><path d="M2 21v-2a4 4 0 0 1 4-4h6" /><path d="m16 18 2 2 4-5" /></svg>;
    case 'megaphone':
      return <svg {...shared}><path d="m3 11 18-5v12L3 14v-3Z" /><path d="M6 15.5 7.5 21h4l-1.2-4.4" /></svg>;
    case 'inbox':
      return <svg {...shared}><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z" /><path d="M8 9h8M8 13h5" /></svg>;
    case 'users':
      return <svg {...shared}><circle cx="9" cy="8" r="4" /><path d="M2 21v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2" /><path d="M17 4.5a4 4 0 0 1 0 7.5M19 14a5 5 0 0 1 3 4.6V21" /></svg>;
    case 'award':
      return <svg {...shared}><circle cx="12" cy="8" r="6" /><path d="m8.5 13-1 9 4.5-3 4.5 3-1-9" /></svg>;
    case 'book':
      return <svg {...shared}><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 3v18M11 8h5M11 12h5" /></svg>;
    case 'file-text':
      return <svg {...shared}><path d="M6 2h9l5 5v15H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" /><path d="M14 2v6h6M8 13h8M8 17h8" /></svg>;
    case 'bar-chart':
      return <svg {...shared}><path d="M4 20V10M10 20V4M16 20v-7M22 20V7M2 20h21" /></svg>;
    case 'user-plus':
      return <svg {...shared}><circle cx="9" cy="7" r="4" /><path d="M2 21v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2M19 8v6M16 11h6" /></svg>;
    case 'shield':
      return <svg {...shared}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></svg>;
    case 'folder':
      return <svg {...shared}><path d="M3 6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z" /></svg>;
    case 'plus-square':
      return <svg {...shared}><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M12 8v8M8 12h8" /></svg>;
    case 'account':
      return <svg {...shared}><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v2" /></svg>;
  }
}

function BrandIcon({ accentColor }: { accentColor: WorkspaceAccent }) {
  return accentColor === 'blue' ? (
    <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M3 21h18M5 21V9h14v12M3 9l9-6 9 6M9 13v4M12 13v4M15 13v4" /></svg>
  ) : (
    <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="8" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M2 20v-2a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v2M14 14h3a5 5 0 0 1 5 5v1" /></svg>
  );
}

function getInitials(fullName: string) {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  return words.slice(-2).map((word) => word[0]?.toUpperCase()).join('') || 'KP';
}

export function RoleWorkspace({ user, title, subtitle, badgeText, accentColor = 'amber', items, activeSection, onSectionChange, headerActions, children, ariaLabel = 'Điều hướng quản lý' }: RoleWorkspaceProps) {
  const { logout } = useAuth();
  const { data: deploymentData } = useDeploymentProfile();
  const brandName = getDeploymentBrand(deploymentData?.profile);

  const styles = ACCENT_STYLES[accentColor];
  const activeItem = items.find((item) => item.id === activeSection) ?? items[0];
  const heading = activeSection === 'overview' ? title : activeItem?.label ?? title;

  return (
    <div className="min-h-screen bg-[#f7f8fa] text-slate-950 lg:flex">
      <aside className="hidden min-h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className={`flex h-[72px] items-center gap-3 px-6 text-white ${styles.brand}`}>
          <BrandIcon accentColor={accentColor} />
          <span className="text-base font-bold tracking-tight truncate">{brandName}</span>
        </div>

        <nav aria-label={ariaLabel} className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
          {items.map((item) => {
            const isActive = item.id === activeSection;
            return (
              <button key={item.id} type="button" onClick={() => onSectionChange(item.id)} aria-current={isActive ? 'page' : undefined} className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${isActive ? styles.active : 'text-slate-700 hover:bg-slate-50 hover:text-slate-950'}`}>
                <NavIcon name={item.iconName} className={`h-5 w-5 shrink-0 ${isActive ? styles.activeIcon : 'text-slate-800'}`} />
                <span className="min-w-0 flex-1 truncate">{item.shortLabel || item.label}</span>
                {item.badge && item.badge.count > 0 && <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${styles.badge}`}>{item.badge.count}</span>}
              </button>
            );
          })}
        </nav>

        <div className="p-3">
          <button type="button" onClick={() => logout()} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${styles.profile}`} aria-label={`Đăng xuất tài khoản ${user.fullName}`}>
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${styles.avatar}`}>{getInitials(user.fullName)}</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-950">{user.fullName}</span><span className="block truncate text-xs text-slate-500">{badgeText}</span></span>
            <svg className="h-4 w-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex min-h-[72px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white lg:hidden ${styles.brand}`}><BrandIcon accentColor={accentColor} /></span>
              <div className="min-w-0"><h1 className="truncate text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">{heading}</h1>{subtitle && <div className="mt-0.5 truncate text-xs text-slate-500 lg:hidden">{subtitle}</div>}</div>
            </div>

            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              {headerActions}
              <NotificationBell currentUser={user} />
              <div className={`hidden items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold sm:flex ${styles.profile}`}>
                <NavIcon name={accentColor === 'blue' ? 'user-check' : 'users'} className={`h-4 w-4 ${styles.activeIcon}`} />
                <span>{badgeText}</span>
                <svg className="h-4 w-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
              </div>
            </div>
          </div>

          <nav aria-label={ariaLabel} className="border-t border-slate-100 px-3 py-2 lg:hidden">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {items.map((item) => {
                const isActive = item.id === activeSection;
                return (
                  <button key={item.id} type="button" onClick={() => onSectionChange(item.id)} aria-current={isActive ? 'page' : undefined} className={`flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition ${isActive ? styles.mobileActive : 'border-slate-200 bg-white text-slate-600'}`}>
                    <NavIcon name={item.iconName} className="h-4 w-4" />
                    {item.shortLabel || item.label}
                    {item.badge && item.badge.count > 0 && <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${styles.badge}`}>{item.badge.count}</span>}
                  </button>
                );
              })}
            </div>
          </nav>
        </header>

        <main className="mx-auto w-full max-w-[1540px] p-4 sm:p-6 lg:p-8">
          <section aria-label={activeItem?.label || title} className="space-y-6">{children}</section>
        </main>
      </div>
    </div>
  );
}
