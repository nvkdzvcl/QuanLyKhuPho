import { useState, useCallback, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ApiResponseEnvelope,
  NotificationListResponseDto,
  NotificationDto,
  UnreadCountResponseDto,
  VapidPublicKeyResponseDto,
} from '@quanlykhupho/shared-types';
import { apiClient } from '../lib/api-client';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function useNotifications(page = 1, limit = 20) {
  return useQuery({
    queryKey: ['notifications', 'list', page, limit],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponseEnvelope<NotificationListResponseDto>>(
        `/notifications?page=${page}&limit=${limit}`,
      );
      return res.data.data;
    },
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponseEnvelope<UnreadCountResponseDto>>(
        '/notifications/unread-count',
      );
      return res.data.data;
    },
    refetchInterval: 30000, // Poll every 30s as lightweight sync
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.patch<ApiResponseEnvelope<NotificationDto>>(
        `/notifications/${id}/read`,
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<ApiResponseEnvelope<{ updatedCount: number }>>(
        '/notifications/mark-all-read',
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    return registration;
  } catch {
    return null;
  }
}

export function usePushSubscription() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [vapidPublicKey, setVapidPublicKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function initializePush() {
      if (
        typeof window === 'undefined' ||
        !('serviceWorker' in navigator) ||
        !('PushManager' in window) ||
        !('Notification' in window)
      ) {
        return;
      }

      setPermission(Notification.permission);

      try {
        const vapidRes = await apiClient.get<
          ApiResponseEnvelope<VapidPublicKeyResponseDto>
        >('/notifications/push/vapid-public-key');
        const config = vapidRes.data?.data;
        if (cancelled || !config?.enabled || !config.publicKey) {
          return;
        }

        setVapidPublicKey(config.publicKey);
        setIsSupported(true);

        const registration = await getServiceWorkerRegistration();
        if (cancelled || !registration) {
          setIsSubscribed(false);
          return;
        }
        const subscription = await registration.pushManager.getSubscription();
        if (!cancelled) {
          setIsSubscribed(Boolean(subscription));
        }
      } catch {
        if (!cancelled) {
          setIsSupported(false);
          setIsSubscribed(false);
        }
      }
    }

    void initializePush();
    return () => {
      cancelled = true;
    };
  }, []);

  const subscribe = useCallback(async () => {
    if (!isSupported || !vapidPublicKey) return false;
    setIsLoading(true);

    try {
      // VAPID availability was verified before requesting browser permission.
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        setIsLoading(false);
        return false;
      }

      // Register service worker and subscribe on browser PushManager.
      const registration = await getServiceWorkerRegistration();
      if (!registration) {
        setIsLoading(false);
        return false;
      }

      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as unknown as BufferSource,
      });

      const subJson = subscription.toJSON();
      if (!subJson.endpoint || !subJson.keys?.p256dh || !subJson.keys?.auth) {
        throw new Error('Invalid subscription keys received from browser');
      }

      // Persist the subscription only after the browser accepted it.
      await apiClient.post('/notifications/push/subscribe', {
        endpoint: subJson.endpoint,
        keys: {
          p256dh: subJson.keys.p256dh,
          auth: subJson.keys.auth,
        },
        userAgent: navigator.userAgent,
      });

      setIsSubscribed(true);
      setIsLoading(false);
      return true;
    } catch {
      setIsLoading(false);
      return false;
    }
  }, [isSupported, vapidPublicKey]);

  const unsubscribe = useCallback(async () => {
    if (!isSupported) return false;
    setIsLoading(true);

    try {
      const registration = await getServiceWorkerRegistration();
      if (!registration) {
        setIsLoading(false);
        return false;
      }
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await apiClient.post('/notifications/push/unsubscribe', {
          endpoint: subscription.endpoint,
        });
        await subscription.unsubscribe();
      }

      setIsSubscribed(false);
      setIsLoading(false);
      return true;
    } catch {
      setIsLoading(false);
      return false;
    }
  }, [isSupported]);

  return {
    isSupported,
    isSubscribed,
    isLoading,
    permission,
    subscribe,
    unsubscribe,
  };
}
