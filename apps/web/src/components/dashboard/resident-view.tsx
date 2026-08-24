'use client';

import React, { useState } from 'react';
import { Alert, Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@quanlykhupho/ui';
import { AccountStatus, type UserDto, UserRole } from '@quanlykhupho/shared-types';
import { useUnreadCount } from '../../hooks/use-notifications';
import { useAuth } from '../../lib/auth-context';
import { AnnouncementFeed } from '../announcements/announcement-feed';
import { CreatePetitionModal } from '../petitions/create-petition-modal';
import { PetitionList } from '../petitions/petition-list';
import { getResidentNavigationItems, normalizeSectionForRole } from './dashboard-navigation';
import { ResidentOverview } from './resident-overview';
import { ResidentWorkspace } from './resident-workspace';

interface ResidentViewProps {
  user: UserDto;
}

function ResidentAccount({ user }: ResidentViewProps) {
  const { logout } = useAuth();
  const rows = [
    { label: 'Họ và tên', value: user.fullName },
    { label: 'Số điện thoại', value: user.maskedPhone },
    { label: 'Địa chỉ nơi ở', value: user.address || 'Chưa cập nhật' },
    { label: 'Khu phố', value: user.neighborhood?.name || 'Chưa phân khu phố' },
    { label: 'Phường', value: user.neighborhood?.ward || 'Chưa cập nhật' },
    { label: 'Quận / Huyện', value: user.neighborhood?.district || 'Chưa cập nhật' },
  ];

  return (
    <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Thông tin tài khoản Cư dân</CardTitle>
              <CardDescription>Dữ liệu cư trú đã được đối chiếu với hồ sơ đăng ký</CardDescription>
            </div>
            <Badge variant={user.status === AccountStatus.ACTIVE ? 'success' : 'warning'}>{user.status === AccountStatus.ACTIVE ? 'Đang hoạt động' : user.status}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="divide-y divide-slate-100">
            {rows.map((row) => (
              <div key={row.label} className="grid gap-1 py-3 text-sm sm:grid-cols-[160px_1fr] sm:gap-4">
                <dt className="text-slate-500">{row.label}</dt>
                <dd className="font-semibold text-slate-950 sm:text-right">{row.value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <div className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>Bảo vệ thông tin cá nhân</CardTitle>
            <CardDescription>Hệ thống chỉ hiển thị dữ liệu nhạy cảm ở dạng che một phần</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            <p className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-blue-800">Số điện thoại của bạn được hiển thị dưới dạng <strong>{user.maskedPhone}</strong>.</p>
            <p>Không chia sẻ mã OTP hoặc phiên đăng nhập cho bất kỳ ai, kể cả người tự xưng là cán bộ quản trị.</p>
          </CardContent>
        </Card>
        <Button variant="outline" size="md" onClick={() => logout()} className="w-full border-red-200 text-red-700 hover:bg-red-50">Đăng xuất khỏi tài khoản</Button>
      </div>
    </div>
  );
}

export function ResidentView({ user }: ResidentViewProps) {
  const [activeSection, setActiveSection] = useState<string>('overview');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const { data: unread } = useUnreadCount();
  const currentSection = normalizeSectionForRole(UserRole.RESIDENT, activeSection);
  const navItems = getResidentNavigationItems({ unreadAnnouncementsCount: unread?.unreadCount || 0 });

  const closeCreatePetition = () => setActiveSection('petitions');

  return (
    <ResidentWorkspace user={user} items={navItems} activeSection={currentSection} onSectionChange={setActiveSection}>
      {toastMessage && <Alert variant="success" message={toastMessage} onClose={() => setToastMessage(null)} />}

      {currentSection === 'overview' && <ResidentOverview user={user} onNavigateSection={setActiveSection} />}

      {currentSection === 'announcements' && <AnnouncementFeed user={user} />}

      {currentSection === 'petitions' && (
        <PetitionList user={user} title="Kiến nghị của tôi" description="Theo dõi tiến trình tiếp nhận, xử lý và phản hồi từ ban quản lý" />
      )}

      {currentSection === 'create-petition' && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-6 text-center">
          <h2 className="text-lg font-bold text-blue-950">Biểu mẫu gửi kiến nghị đang mở</h2>
          <p className="mt-1 text-sm text-blue-700">Điền đầy đủ nội dung và hình ảnh minh chứng để ban quản lý tiếp nhận nhanh hơn.</p>
          <Button variant="primary" size="sm" onClick={() => setActiveSection('petitions')} className="mt-4">Đóng biểu mẫu</Button>
        </div>
      )}

      {currentSection === 'account' && <ResidentAccount user={user} />}

      <CreatePetitionModal
        isOpen={currentSection === 'create-petition'}
        onClose={closeCreatePetition}
        user={user}
        onCreated={() => {
          setToastMessage('Đã gửi kiến nghị mới thành công!');
          setActiveSection('petitions');
        }}
      />
    </ResidentWorkspace>
  );
}
