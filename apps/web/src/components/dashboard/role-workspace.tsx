'use client';

import React from 'react';
import { Badge } from '@quanlykhupho/ui';
import type { NavigationItem } from './dashboard-navigation';

export type WorkspaceAccent = 'amber' | 'blue';

export interface RoleWorkspaceProps {
  title: string;
  subtitle?: React.ReactNode;
  badgeText?: string;
  bannerGradient?: string;
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
    mobileActiveIcon: 'text-amber-300',
    mobileActiveBadge: 'bg-amber-400 text-slate-900',
    mobileInactiveBadge: 'bg-amber-100 text-amber-800',
    desktopActiveButton:
      'bg-amber-50 text-amber-950 font-bold border-l-4 border-amber-600 shadow-xs pl-2.5',
    desktopActiveIcon: 'text-amber-600',
  },
  blue: {
    mobileActiveIcon: 'text-blue-300',
    mobileActiveBadge: 'bg-blue-400 text-slate-900',
    mobileInactiveBadge: 'bg-blue-100 text-blue-800',
    desktopActiveButton:
      'bg-blue-50 text-blue-950 font-bold border-l-4 border-blue-600 shadow-xs pl-2.5',
    desktopActiveIcon: 'text-blue-600',
  },
} as const;

function NavIcon({ name, className = 'h-5 w-5' }: { name: string; className?: string }) {
  switch (name) {
    case 'overview':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
        </svg>
      );
    case 'user-check':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <polyline points="16 11 18 13 22 9" />
        </svg>
      );
    case 'megaphone':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m3 11 18-5v12L3 14v-3z" />
          <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
        </svg>
      );
    case 'inbox':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
          <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
        </svg>
      );
    case 'users':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case 'award':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="8" r="7" />
          <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
        </svg>
      );
    case 'book':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
          <path d="M6 6h10" />
          <path d="M6 10h10" />
        </svg>
      );
    case 'file-text':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
          <path d="M14 2v4a2 2 0 0 0 2 2h4" />
          <path d="M10 9H8" />
          <path d="M16 13H8" />
          <path d="M16 17H8" />
        </svg>
      );
    case 'bar-chart':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="12" y1="20" x2="12" y2="10" />
          <line x1="18" y1="20" x2="18" y2="4" />
          <line x1="6" y1="20" x2="6" y2="16" />
        </svg>
      );
    case 'user-plus':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <line x1="19" y1="8" x2="19" y2="14" />
          <line x1="22" y1="11" x2="16" y2="11" />
        </svg>
      );
    case 'shield':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    case 'folder':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
        </svg>
      );
    default:
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      );
  }
}

export function RoleWorkspace({
  title,
  subtitle,
  badgeText = 'Trang quản trị',
  bannerGradient = 'from-amber-600 to-orange-600',
  accentColor = 'amber',
  items,
  activeSection,
  onSectionChange,
  headerActions,
  children,
  ariaLabel = 'Điều hướng khu phố',
}: RoleWorkspaceProps) {
  const styles = ACCENT_STYLES[accentColor] || ACCENT_STYLES.amber;

  // Group navigation items if groups exist
  const groups: { name: string; items: NavigationItem[] }[] = [];
  items.forEach((item) => {
    const groupName = item.group || 'Chung';
    const existing = groups.find((g) => g.name === groupName);
    if (existing) {
      existing.items.push(item);
    } else {
      groups.push({ name: groupName, items: [item] });
    }
  });

  const activeItem = items.find((item) => item.id === activeSection) || items[0];

  return (
    <div className="space-y-6">
      {/* Top Banner / Identity Header */}
      <div
        className={`rounded-3xl bg-gradient-to-r ${bannerGradient} p-5 text-white shadow-lg sm:p-7 lg:p-8`}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="inline-flex items-center rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
              {badgeText}
            </span>
            <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              {title}
            </h2>
            {subtitle && (
              <div className="text-xs text-white/90 sm:text-sm font-normal">
                {subtitle}
              </div>
            )}
          </div>
          {headerActions && (
            <div className="flex items-center gap-2">{headerActions}</div>
          )}
        </div>
      </div>

      {/* Mobile Horizontal Navigation Tab Bar (< lg) */}
      <nav
        aria-label={ariaLabel}
        className="block lg:hidden sticky top-16 z-30 -mx-3 px-3 sm:-mx-6 sm:px-6 py-2 bg-slate-50/95 backdrop-blur-md border-b border-slate-200/80"
      >
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1">
          {items.map((item) => {
            const isActive = item.id === activeSection;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSectionChange(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-sm ring-1 ring-slate-900'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <NavIcon
                  name={item.iconName}
                  className={`h-4 w-4 shrink-0 ${
                    isActive ? styles.mobileActiveIcon : 'text-slate-500'
                  }`}
                />
                <span>{item.shortLabel || item.label}</span>
                {item.badge && item.badge.count > 0 && (
                  <span
                    className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      isActive
                        ? styles.mobileActiveBadge
                        : styles.mobileInactiveBadge
                    }`}
                  >
                    {item.badge.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Main Workspace Layout (Sidebar on Desktop, Main Content on Right) */}
      <div className="lg:grid lg:grid-cols-12 lg:gap-8 lg:items-start">
        {/* Desktop Sidebar Navigation (lg:block) */}
        <aside className="hidden lg:col-span-4 xl:col-span-3 lg:block sticky top-20 space-y-4">
          <nav
            aria-label={ariaLabel}
            className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm space-y-4"
          >
            <div className="px-3 pt-2 pb-1 border-b border-slate-100">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Danh mục quản lý
              </span>
            </div>

            <div className="space-y-4">
              {groups.map((group) => (
                <div key={group.name} className="space-y-1">
                  {groups.length > 1 && (
                    <div className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      {group.name}
                    </div>
                  )}
                  <div className="space-y-1">
                    {group.items.map((item) => {
                      const isActive = item.id === activeSection;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => onSectionChange(item.id)}
                          aria-current={isActive ? 'page' : undefined}
                          className={`w-full flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                            isActive
                              ? styles.desktopActiveButton
                              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <NavIcon
                              name={item.iconName}
                              className={`h-5 w-5 shrink-0 ${
                                isActive
                                  ? styles.desktopActiveIcon
                                  : 'text-slate-400 group-hover:text-slate-600'
                              }`}
                            />
                            <div className="truncate">
                              <div className="leading-tight">{item.label}</div>
                            </div>
                          </div>

                          {item.badge && item.badge.count > 0 && (
                            <Badge
                              variant={item.badge.variant || (accentColor === 'blue' ? 'info' : 'warning')}
                              className="shrink-0 text-xs px-2 py-0.5"
                            >
                              {item.badge.count}
                            </Badge>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </nav>
        </aside>

        {/* Workspace Active Section Content */}
        <section
          className="lg:col-span-8 xl:col-span-9 min-w-0"
          aria-labelledby="active-section-heading"
        >
          {/* Section Breadcrumb Header for Clarity */}
          <div className="mb-4 flex items-center justify-between border-b border-slate-200/80 pb-3">
            <div>
              <h3
                id="active-section-heading"
                className="text-lg font-extrabold text-slate-900 sm:text-xl leading-tight"
              >
                {activeItem?.label}
              </h3>
              {activeItem?.description && (
                <p className="mt-0.5 text-xs text-slate-500">
                  {activeItem.description}
                </p>
              )}
            </div>
            {activeItem?.badge && activeItem.badge.count > 0 && (
              <Badge variant={activeItem.badge.variant || (accentColor === 'blue' ? 'info' : 'warning')}>
                {activeItem.badge.count} mục cần xử lý
              </Badge>
            )}
          </div>

          {/* Active section rendered dynamically */}
          <div className="space-y-6">{children}</div>
        </section>
      </div>
    </div>
  );
}
