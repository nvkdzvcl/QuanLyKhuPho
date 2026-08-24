'use client';

import React, { useState } from 'react';
import { Button } from '@quanlykhupho/ui';
import { UserRole } from '@quanlykhupho/shared-types';
import { useAuth } from '../lib/auth-context';
import { Header } from '../components/shell/header';
import { AuthFlowModal } from '../components/auth/auth-flow-modal';
import { ResidentView } from '../components/dashboard/resident-view';
import { LeaderView } from '../components/dashboard/leader-view';
import { OfficerView } from '../components/dashboard/officer-view';
import { HealthStatusWidget } from '../components/health-status';

export default function HomePage() {
  const { user, isLoading } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Role-Aware Header Shell */}
      <Header user={user} onOpenLoginModal={() => setIsAuthModalOpen(true)} />

      {/* Main Container */}
      <main
        className={`flex-1 mx-auto w-full px-3 py-4 sm:px-6 sm:py-6 lg:px-8 ${
          user && user.role !== UserRole.RESIDENT
            ? 'max-w-[1440px]'
            : 'max-w-7xl'
        }`}
      >
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <svg
              className="animate-spin h-8 w-8 text-blue-600 mb-3"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <p className="text-sm font-medium">Đang kiểm tra phiên đăng nhập...</p>
          </div>
        ) : user ? (
          /* Authenticated Dashboard according to User Role */
          <div>
            {user.role === UserRole.RESIDENT && <ResidentView user={user} />}
            {user.role === UserRole.LEADER && <LeaderView user={user} />}
            {user.role === UserRole.OFFICER && <OfficerView user={user} />}
          </div>
        ) : (
          /* Public Landing & Hero View */
          <div className="space-y-12 py-4">
            <section className="text-center max-w-3xl mx-auto pt-6 sm:pt-10">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3.5 py-1 text-xs font-semibold text-blue-800">
                Hệ thống Quản lý Khu phố Điện tử (Sprint 1A)
              </span>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-5xl leading-tight">
                Nền tảng số hoá quản trị <br />
                Tổ dân phố & Khu phố
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-base text-slate-600 sm:text-lg leading-relaxed">
                Đăng nhập tức thì qua mã xác thực OTP tin nhắn SMS, kết nối Cư dân, Trưởng khu phố và Cán bộ phường trong một giao diện thông minh và bảo mật.
              </p>

              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => setIsAuthModalOpen(true)}
                  className="shadow-md font-semibold"
                >
                  Đăng nhập / Đăng ký Cư dân
                </Button>
              </div>
            </section>

            {/* Feature Highlights Grid */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 pt-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 font-bold text-xl">
                  📱
                </div>
                <h3 className="mt-4 text-base font-bold text-slate-900">
                  Đăng nhập OTP không cần mật khẩu
                </h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  Xác thực 6 chữ số qua SMS, giới hạn chống spam 3 lần/phút và tự động khóa bảo vệ 15 phút nếu nhập sai quá 3 lần.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600 font-bold text-xl">
                  🛡️
                </div>
                <h3 className="mt-4 text-base font-bold text-slate-900">
                  Phân quyền & Xét duyệt Cư dân
                </h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  Trưởng khu phố duyệt hoặc từ chối hồ sơ đăng ký cư dân trong địa bàn. Cán bộ phường phân công và bổ nhiệm Trưởng khu phố.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 font-bold text-xl">
                  🔒
                </div>
                <h3 className="mt-4 text-base font-bold text-slate-900">
                  Bảo mật Phiên & Mã hóa Dữ liệu
                </h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  Phiên đăng nhập 7 ngày an toàn qua HttpOnly cookie, mã hóa AES-256 số điện thoại và thông điệp hàng đợi SMS RabbitMQ.
                </p>
              </div>
            </div>

            {/* Health Status Widget Section */}
            <div className="mx-auto max-w-4xl pt-6">
              <HealthStatusWidget />
            </div>
          </div>
        )}
      </main>

      {/* Auth Modal Flow */}
      <AuthFlowModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-6">
        <div className="mx-auto max-w-7xl px-4 text-center text-xs text-slate-500 sm:px-6 lg:px-8">
          <p>© 2026 QuanLyKhuPho. Nền tảng số hoá quản lý khu phố hiện đại.</p>
        </div>
      </footer>
    </div>
  );
}
