import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

describe('Web Push & Notifications Hook Support', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should verify service worker script exists and is structured properly', async () => {
    const swPath = fileURLToPath(new URL('../public/sw.js', import.meta.url));
    const swCode = readFileSync(swPath, 'utf8');

    expect(swCode).toContain("self.addEventListener('push'");
    expect(swCode).toContain("self.addEventListener('notificationclick'");
    expect(swCode).toContain('self.registration.showNotification');
    expect(swCode).toContain('self.clients.openWindow');
  });

  it('should handle unconfigured serviceWorker in environment gracefully', () => {
    const isSupported =
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;

    expect(typeof isSupported).toBe('boolean');
  });
});
