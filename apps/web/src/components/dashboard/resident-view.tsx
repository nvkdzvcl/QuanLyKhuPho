'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge } from '@quanlykhupho/ui';
import { UserDto } from '@quanlykhupho/shared-types';

interface ResidentViewProps {
  user: UserDto;
}

export function ResidentView({ user }: ResidentViewProps) {
  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white shadow-lg sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="inline-flex rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
              Cổng thông tin Cư dân
            </span>
            <h2 className="mt-2 text-2xl font-extrabold sm:text-3xl">
              Xin chào, {user.fullName}!
            </h2>
            <p className="mt-1 text-sm text-blue-100">
              Bạn đang sinh sống tại{' '}
              <strong>{user.neighborhood?.name || 'Khu phố'}</strong>, {user.neighborhood?.ward},{' '}
              {user.neighborhood?.district}.
            </p>
          </div>
          <Badge variant="success" className="bg-emerald-500/20 text-emerald-100 border-emerald-400/30 text-xs px-3 py-1">
            Tài khoản đã kích hoạt
          </Badge>
        </div>
      </div>

      {/* Resident Profile & Household Info Card */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Thông tin Cư trú của bạn</CardTitle>
            <CardDescription>Dữ liệu đã được đối chiếu và xác thực</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="text-slate-500">Họ và tên:</span>
              <span className="font-semibold text-slate-900">{user.fullName}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="text-slate-500">Số điện thoại (đã mã hóa):</span>
              <span className="font-mono font-semibold text-slate-900">{user.maskedPhone}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="text-slate-500">Địa chỉ nơi ở:</span>
              <span className="font-semibold text-slate-900 text-right">{user.address || 'Chưa cập nhật'}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="text-slate-500">Khu phố:</span>
              <span className="font-semibold text-blue-600">{user.neighborhood?.name}</span>
            </div>
            <div className="flex justify-between pb-1">
              <span className="text-slate-500">Trạng thái:</span>
              <Badge variant="success">Hoạt động (Active)</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Community Utilities Card */}
        <Card>
          <CardHeader>
            <CardTitle>Dịch vụ Tiện ích Khu phố</CardTitle>
            <CardDescription>Các tính năng số hóa dành cho cư dân</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 transition hover:bg-slate-100/80">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 font-bold">
                  🔔
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Bảng tin & Thông báo</h4>
                  <p className="text-xs text-slate-500">Nhận thông báo họp tổ dân phố và tin tức an ninh.</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 transition hover:bg-slate-100/80">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700 font-bold">
                  📝
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Phản ánh & Kiến nghị</h4>
                  <p className="text-xs text-slate-500">Gửi kiến nghị về môi trường, trật tự tới Trưởng khu phố.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
