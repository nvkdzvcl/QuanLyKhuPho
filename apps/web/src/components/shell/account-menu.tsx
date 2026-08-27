'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import type { UserDto } from '@quanlykhupho/shared-types';
import { useAuth } from '../../lib/auth-context';
import { AppIcon } from '../app-icon';

export interface AccountMenuProps {
  user: UserDto;
  subtitle: string;
  variant?: 'amber' | 'blue' | 'dark';
  onNavigateToAccount?: () => void;
}

function getInitials(fullName: string) {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  return words.slice(-2).map((word) => word[0]?.toUpperCase()).join('') || 'KP';
}

export function AccountMenu({
  user,
  subtitle,
  variant = 'blue',
  onNavigateToAccount,
}: AccountMenuProps) {
  const { logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const accountActionRef = useRef<HTMLButtonElement>(null);
  const logoutRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      (accountActionRef.current ?? logoutRef.current)?.focus();
    }
  }, [isOpen]);

  const isDark = variant === 'dark';
  const isAmber = variant === 'amber';

  const avatarStyles = isDark
    ? 'bg-white text-blue-700 font-bold'
    : isAmber
    ? 'bg-amber-100 text-amber-700 font-bold'
    : 'bg-blue-100 text-blue-700 font-bold';

  const triggerStyles = isDark
    ? 'border-white/20 bg-white/5 text-white hover:bg-white/10 focus-visible:ring-white'
    : isAmber
    ? 'border-amber-200 hover:bg-amber-50/70 text-slate-950 focus-visible:ring-blue-600'
    : 'border-blue-200 hover:bg-blue-50/70 text-slate-950 focus-visible:ring-blue-600';

  const chevronColor = isDark ? 'text-blue-100' : 'text-slate-500';

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Popover Menu */}
      {isOpen && (
        <div
          id={menuId}
          role="menu"
          aria-orientation="vertical"
          aria-label="Tùy chọn tài khoản"
          className="absolute bottom-full left-0 mb-2 w-full min-w-[240px] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl text-slate-950 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150"
        >
          {/* Identity details */}
          <div className="px-2 py-1.5 space-y-1">
            <p className="font-bold text-sm text-slate-900 truncate">
              {user.fullName}
            </p>
            {user.maskedPhone && (
              <p className="text-xs text-slate-500 font-mono">{user.maskedPhone}</p>
            )}
            <div className="pt-1">
              <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                {subtitle}
              </span>
            </div>
          </div>

          <div className="my-2 border-t border-slate-100" />

          {/* Action buttons */}
          <div className="space-y-1">
            {onNavigateToAccount && (
              <button
                ref={accountActionRef}
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsOpen(false);
                  onNavigateToAccount();
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 transition"
              >
                <AppIcon name="user" className="h-4 w-4 text-slate-500 shrink-0" />
                <span>Thông tin tài khoản</span>
              </button>
            )}

            <button
              ref={logoutRef}
              type="button"
              role="menuitem"
              onClick={() => {
                setIsOpen(false);
                logout();
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-semibold text-red-600 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 transition"
            >
              <AppIcon name="log-out" className="h-4 w-4 text-red-500 shrink-0" />
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>
      )}

      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        aria-label={`Tài khoản ${user.fullName}`}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition focus:outline-none focus-visible:ring-2 ${triggerStyles}`}
      >
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm ${avatarStyles}`}
        >
          {getInitials(user.fullName)}
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={`block truncate text-sm font-semibold ${
              isDark ? 'text-white' : 'text-slate-950'
            }`}
          >
            {user.fullName}
          </span>
          <span
            className={`block truncate text-xs ${
              isDark ? 'text-blue-100' : 'text-slate-500'
            }`}
          >
            {subtitle}
          </span>
        </span>
        <AppIcon
          name={isOpen ? 'chevron-up' : 'chevron-down'}
          className={`h-4 w-4 shrink-0 transition-transform ${chevronColor}`}
        />
      </button>
    </div>
  );
}
