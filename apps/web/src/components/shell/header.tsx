'use client';

import React, { useState } from 'react';
import { Badge, Button } from '@quanlykhupho/ui';
import { UserDto, UserRole } from '@quanlykhupho/shared-types';
import { useAuth } from '../../lib/auth-context';

interface HeaderProps {
  user: UserDto | null;
  onOpenLoginModal?: () => void;
}

export function Header({ user, onOpenLoginModal }: HeaderProps) {
  const { logout } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);

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
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
        {/* Brand Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 font-bold text-white shadow-md">
            KP
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                Quản Lý Khu Phố
              </h1>
              {user && (
                <Badge variant={getRoleBadgeVariant(user.role)}>
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
              {/* In-app Notification Bell Placeholder (Fallback for Push) */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowNotifications(!showNotifications)}
                  aria-label="Thông báo trong ứng dụng"
                  className="relative rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                    />
                  </svg>
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
                    1
                  </span>
                </button>

                {/* Notifications dropdown popup */}
                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl z-50">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <h4 className="text-sm font-bold text-slate-900">Thông báo hệ thống</h4>
                      <span className="text-xs text-slate-400">Tin mới</span>
                    </div>
                    <div className="mt-3 space-y-2 text-xs">
                      <div className="rounded-lg bg-blue-50/70 p-2.5 text-blue-900">
                        <p className="font-semibold">Chào mừng đến với Khu phố điện tử</p>
                        <p className="mt-0.5 text-slate-600">
                          Hệ thống đã kích hoạt xác thực an toàn qua OTP và bảo mật phiên 7 ngày.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* User Name & Logout */}
              <div className="hidden text-right md:block">
                <p className="text-xs font-semibold text-slate-900">{user.fullName}</p>
                <p className="text-[11px] text-slate-500 font-mono">{user.maskedPhone}</p>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => logout()}
                className="text-xs font-semibold"
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
