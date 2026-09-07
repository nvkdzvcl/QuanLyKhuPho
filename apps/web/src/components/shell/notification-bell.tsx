'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Alert, Badge, Button } from '@quanlykhupho/ui';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  usePushSubscription,
  useUnreadCount,
} from '../../hooks/use-notifications';
import { AnnouncementDetailModal } from '../announcements/announcement-detail-modal';
import { PetitionDetailModal } from '../petitions/petition-detail-modal';
import { NotificationDto, NotificationType, UserDto } from '@quanlykhupho/shared-types';
import { AppIcon } from '../app-icon';

interface NotificationBellProps {
  currentUser: UserDto;
}

export function NotificationBell({ currentUser }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeAnnouncementId, setActiveAnnouncementId] = useState<string | null>(null);
  const [activePetitionId, setActivePetitionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: unreadData, refetch: refetchUnreadCount } = useUnreadCount();
  const unreadCount = unreadData?.unreadCount || 0;

  const {
    data: notifData,
    isLoading,
    isError,
    refetch,
  } = useNotifications(1, 15);
  const markReadMutation = useMarkNotificationRead();
  const markAllReadMutation = useMarkAllNotificationsRead();

  const {
    isSupported: isPushSupported,
    isSubscribed: isPushSubscribed,
    isLoading: isPushLoading,
    subscribe: subscribePush,
    unsubscribe: unsubscribePush,
  } = usePushSubscription();

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Fetch fresh notifications when dropdown opens
  useEffect(() => {
    if (isOpen) {
      void refetch();
      void refetchUnreadCount();
    }
  }, [isOpen, refetch, refetchUnreadCount]);

  const handleNotificationClick = async (notif: NotificationDto) => {
    setActionError(null);
    if (notif.referenceId) {
      if (notif.type === NotificationType.PETITION) {
        setActivePetitionId(notif.referenceId);
        setIsOpen(false);
      } else if (
        notif.type === NotificationType.ANNOUNCEMENT ||
        notif.type === NotificationType.COMMENT
      ) {
        setActiveAnnouncementId(notif.referenceId);
        setIsOpen(false);
      }
    }
    if (!notif.isRead) {
      try {
        await markReadMutation.mutateAsync(notif.id);
      } catch {
        setActionError('Không thể đánh dấu đã đọc thông báo. Vui lòng thử lại sau.');
      }
    }
  };

  const handleMarkAllRead = async () => {
    setActionError(null);
    try {
      await markAllReadMutation.mutateAsync();
    } catch {
      setActionError('Không thể đánh dấu tất cả đã đọc. Vui lòng thử lại sau.');
    }
  };

  const handleTogglePush = async () => {
    if (isPushSubscribed) {
      await unsubscribePush();
    } else {
      await subscribePush();
    }
  };

  const notifications = notifData?.items || [];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Thông báo trong ứng dụng"
        aria-expanded={isOpen}
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
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white shadow-sm">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Dropdown Drawer */}
      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-[calc(100vw-2rem)] max-w-96 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl animate-in fade-in zoom-in-95 duration-100">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-slate-900">Thông báo</h4>
              {unreadCount > 0 && (
                <Badge variant="warning" className="text-[10px]">
                  {unreadCount} mới
                </Badge>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={markAllReadMutation.isPending}
                className="text-[11px] font-semibold text-blue-600 hover:text-blue-800"
              >
                Đọc tất cả
              </button>
            )}
          </div>

          {/* Web Push Subscription Banner */}
          {isPushSupported && (
            <div className="my-2.5 flex items-center justify-between rounded-xl bg-slate-50 p-2.5 border border-slate-100 text-xs">
              <div className="space-y-0.5">
                <p className="flex items-center gap-1.5 font-semibold text-slate-800">
                  <AppIcon
                    name={isPushSubscribed ? 'bell' : 'bell-off'}
                    className="h-3.5 w-3.5 text-blue-600 shrink-0"
                  />
                  <span>
                    {isPushSubscribed ? 'Đã bật thông báo đẩy' : 'Chưa bật thông báo đẩy'}
                  </span>
                </p>
                <p className="text-[11px] text-slate-500">
                  {isPushSubscribed
                    ? 'Nhận tin tức tức thì trên trình duyệt'
                    : 'Bật để nhận tin khẩn cấp từ ban quản trị'}
                </p>
              </div>
              <Button
                variant={isPushSubscribed ? 'outline' : 'primary'}
                size="sm"
                onClick={handleTogglePush}
                isLoading={isPushLoading}
                className="text-[11px] py-1 px-2.5 shrink-0"
              >
                {isPushSubscribed ? 'Tắt' : 'Bật'}
              </Button>
            </div>
          )}

          {/* Notification List */}
          <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 mt-1">
            {isLoading ? (
              <div className="py-8 text-center text-xs text-slate-400">
                Đang tải thông báo...
              </div>
            ) : isError ? (
              <div className="py-6 text-center text-xs text-red-600 space-y-2">
                <p>Không thể tải danh sách thông báo.</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void refetch()}
                  className="text-[11px] py-1 px-2.5 mx-auto"
                >
                  Thử lại
                </Button>
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                Không có thông báo nào.
              </div>
            ) : (
              notifications.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => void handleNotificationClick(item)}
                  className={`w-full text-left p-2.5 transition cursor-pointer hover:bg-slate-50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    !item.isRead ? 'bg-blue-50/50' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <p
                      className={`text-xs font-medium leading-snug ${
                        !item.isRead ? 'font-bold text-blue-950' : 'text-slate-800'
                      }`}
                    >
                      {item.title}
                    </p>
                    {!item.isRead && (
                      <span className="h-2 w-2 rounded-full bg-blue-600 shrink-0 mt-1" />
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                    {item.content}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-400">
                    {new Date(item.createdAt).toLocaleString('vi-VN')}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {actionError && (
        <div className="fixed bottom-24 right-4 z-[100] w-[calc(100vw-2rem)] max-w-sm">
          <Alert
            variant="error"
            message={actionError}
            onClose={() => setActionError(null)}
          />
        </div>
      )}

      {/* Target Announcement Detail Modal if clicked */}
      {activeAnnouncementId && (
        <AnnouncementDetailModal
          announcementId={activeAnnouncementId}
          onClose={() => setActiveAnnouncementId(null)}
          currentUser={currentUser}
        />
      )}

      {/* Target Petition Detail Modal if clicked */}
      {activePetitionId && (
        <PetitionDetailModal
          petitionId={activePetitionId}
          onClose={() => setActivePetitionId(null)}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}
