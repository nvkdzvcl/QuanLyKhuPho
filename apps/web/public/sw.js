// Service Worker for Web Push notifications
self.addEventListener('push', (event) => {
  if (!event.data) {
    return;
  }

  let payload = {
    title: 'Thông báo mới',
    body: '',
    data: { url: '/' },
  };

  try {
    payload = event.data.json();
  } catch {
    payload.body = event.data.text();
  }

  const title = payload.title || 'Thông báo mới';
  const options = {
    body: payload.body || payload.content || '',
    data: payload.data || { url: payload.url || '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    }),
  );
});
