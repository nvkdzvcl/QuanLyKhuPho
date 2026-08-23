'use client';

import React from 'react';
import { Badge, Button } from '@quanlykhupho/ui';
import { UserDto, UserRole } from '@quanlykhupho/shared-types';
import { useAuth } from '../../lib/auth-context';

import { NotificationBell } from './notification-bell';

interface HeaderProps {
  user: UserDto | null;
  onOpenLoginModal?: () => void;
}

export function Header({ user, onOpenLoginModal }: HeaderProps) {
  const { logout } = useAuth();

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case UserRole.OFFICER:
        return 'Cán bộ phường';
      case UserRole.LEADER:
        return 'Trưởng khu phố';
      case UserRole.RESIDENT:
      default:
        return 'Cư dân';
    }
  };

  const getRoleBadgeVariant = (role: UserRole) => {
    switch (role) {
      case UserRole.OFFICER:
        return 'info';
      case UserRole.LEADER:
        return 'warning';
      case UserRole.RESIDENT:
      default:
        return 'success';
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-3.5 sm:px-6 lg:px-8">
        {/* Brand Logo & Title */}
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 font-bold text-white shadow-md">
            KP
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                Quản Lý Khu Phố
              </h1>
              {user && (
                <Badge
                  variant={getRoleBadgeVariant(user.role)}
                  className="hidden sm:inline-flex"
                >
                  {getRoleLabel(user.role)}
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-500 truncate max-w-[200px] sm:max-w-none">
              {user?.neighborhood?.name
                ? `${user.neighborhood.name} - ${user.neighborhood.ward}`
                : 'Nền tảng số hoá quản trị tổ dân phố'}
            </p>
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {user ? (
            <>
              {/* In-app Notification Bell */}
              <NotificationBell currentUser={user} />

              {/* User Name & Logout */}
              <div className="hidden text-right md:block">
                <p className="text-xs font-semibold text-slate-900">{user.fullName}</p>
                <p className="text-[11px] text-slate-500 font-mono">{user.maskedPhone}</p>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => logout()}
                className="px-2 text-xs font-semibold sm:px-3"
              >
                Đăng xuất
              </Button>
            </>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={onOpenLoginModal}
              className="text-xs sm:text-sm"
            >
              Đăng nhập / Đăng ký
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
