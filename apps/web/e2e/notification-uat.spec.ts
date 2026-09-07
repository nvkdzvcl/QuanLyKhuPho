import { test, expect, type Page } from '@playwright/test';

// Browser regression tests with synthetic API responses; never touch the local DB.
type Role = 'resident' | 'leader' | 'officer';
type Notice = { id: string; type: string; referenceId: string | null; title: string; isRead: boolean };
const timestamp = '2026-09-07T10:00:00.000Z';
const petitionNotice = (): Notice => ({ id: 'notice-1', type: 'petition', referenceId: 'petition-1', title: 'UAT: Kiến nghị cần xem', isRead: false });

async function setup(page: Page, role: Role = 'resident') {
  const state = {
    items: [petitionNotice()], failList: false, failRead: false,
    status: 'reviewing', listRequests: 0, detailRequests: [] as string[], readRequests: 0,
  };
  const neighborhood = { id: 'kp-1', name: 'Khu phố UAT 1', ward: 'Phường UAT', district: 'Địa bàn UAT' };
  const user = { id: `uat-${role}`, role, status: 'active', fullName: 'Người kiểm thử UAT', maskedPhone: '090***0000', neighborhoodId: 'kp-1', neighborhood, createdAt: timestamp };
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, '');
    const ok = (data: unknown) => route.fulfill({ json: { success: true, data, timestamp } });
    const fail = () => route.fulfill({ status: 503, json: { success: false, error: { code: 'SERVICE_UNAVAILABLE', message: 'Dịch vụ tạm thời không sẵn sàng.' } } });
    if (path === '/auth/me') return ok({ user });
    if (path === '/deployment-profile') return ok({ initialized: false, profile: null });
    if (path === '/notifications/push/vapid-public-key') return ok({ enabled: false });
    if (path === '/notifications/unread-count') return ok({ unreadCount: state.items.filter((item) => !item.isRead).length });
    if (path === '/notifications') {
      state.listRequests++;
      if (state.failList) return fail();
      return ok({ items: state.items.map((item) => ({ ...item, accountId: user.id, content: 'Nội dung kiểm thử giả lập', createdAt: timestamp })), total: state.items.length, unreadCount: state.items.filter((item) => !item.isRead).length });
    }
    if (/^\/notifications\/[^/]+\/read$/.test(path)) {
      state.readRequests++;
      if (state.failRead) return fail();
      const item = state.items.find((entry) => path === `/notifications/${entry.id}/read`);
      if (item) item.isRead = true;
      return ok(item);
    }
    if (path === '/notifications/mark-all-read') {
      if (state.failRead) return fail();
      state.items.forEach((item) => { item.isRead = true; });
      return ok({ updatedCount: state.items.length });
    }
    if (path === '/petitions/petition-1') {
      state.detailRequests.push(path);
      return ok({ id: 'petition-1', title: 'Kiến nghị UAT về đèn đường', description: 'Nội dung giả lập để kiểm tra mở đúng chi tiết.', category: 'infrastructure', status: state.status, neighborhoodId: 'kp-1', neighborhood, authorId: 'uat-resident', author: { ...user, id: 'uat-resident', role: 'resident' }, evidence: [], createdAt: timestamp, updatedAt: timestamp,
        history: [{ id: 'history-1', fromStatus: 'reviewing', toStatus: state.status, createdAt: timestamp, changedBy: { id: 'uat-leader', role: 'leader', fullName: 'Tổ trưởng UAT' }, note: 'Ghi chú kiểm thử' }] });
    }
    if (/^\/announcements\/[^/]+$/.test(path)) {
      state.detailRequests.push(path);
      return ok({ id: path.split('/').pop(), title: 'Bài đăng UAT', content: 'Nội dung bảng tin kiểm thử', scope: 'neighborhood', neighborhoodId: 'kp-1', neighborhood, author: { ...user, role: 'leader' }, status: 'published', attachments: [], comments: [], createdAt: timestamp });
    }
    if (path === '/announcements' || path === '/petitions') return ok({ items: [], total: 0, page: 1, limit: 20 });
    if (path === '/neighborhoods') return ok([neighborhood]);
    // Unused dashboard widgets may show their error state; keep all calls isolated.
    return route.fulfill({ status: 404, json: { success: false, error: { code: 'NOT_FOUND', message: 'Không có dữ liệu thử cho tiện ích này.' } } });
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Thông báo trong ứng dụng' })).toBeVisible();
  return state;
}

async function openBell(page: Page) {
  await page.getByRole('button', { name: 'Thông báo trong ứng dụng' }).click();
}

for (const role of ['resident', 'leader', 'officer'] as const) {
  test(`${role}: petition notification opens petition detail and marks read`, async ({ page }) => {
    const state = await setup(page, role);
    await openBell(page);
    await page.getByRole('button', { name: /UAT: Kiến nghị cần xem/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Chi tiết Kiến nghị & Phản ánh' });
    await expect(dialog.getByText('Kiến nghị UAT về đèn đường', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Trạng thái hiện tại:', { exact: false })).toContainText('Chờ tiếp nhận');
    await expect(dialog.getByText('(từ Chờ tiếp nhận)', { exact: true })).toBeVisible();
    await expect.poll(() => state.readRequests).toBe(1);
    expect(state.detailRequests).toEqual(['/petitions/petition-1']);
    await page.getByRole('button', { name: 'Đóng hộp thoại' }).click();
    await expect(page.getByRole('button', { name: 'Thông báo trong ứng dụng' })).not.toContainText('1');
  });
}

for (const type of ['announcement', 'comment']) {
  test(`${type}: notification opens the referenced announcement`, async ({ page }) => {
    const state = await setup(page);
    state.items = [{ ...petitionNotice(), type, referenceId: 'announcement-1', title: 'UAT: Tin và bình luận' }];
    await openBell(page);
    await page.getByRole('button', { name: /UAT: Tin và bình luận/ }).click();
    await expect(page.getByRole('dialog', { name: 'Bài đăng UAT' }).getByRole('heading', { name: 'Bài đăng UAT', exact: true })).toBeVisible();
    expect(state.detailRequests).toEqual(['/announcements/announcement-1']);
  });
}

test('opening the bell refreshes a previously empty list; petition count is not a feed badge', async ({ page }) => {
  const state = await setup(page);
  state.items = [];
  await openBell(page);
  await expect(page.getByText('Không có thông báo nào.', { exact: true })).toBeVisible();
  await openBell(page);
  const previousRequests = state.listRequests;
  state.items = [petitionNotice()];
  await openBell(page);
  await expect(page.getByRole('button', { name: /UAT: Kiến nghị cần xem/ })).toBeVisible();
  expect(state.listRequests).toBeGreaterThan(previousRequests);
  await openBell(page);
  const nav = page.getByRole('navigation', { name: 'Điều hướng Cư dân', exact: true });
  const mobileNav = page.getByRole('navigation', { name: 'Điều hướng Cư dân trên điện thoại', exact: true });
  const announcementButton = (await nav.isVisible() ? nav : mobileNav).getByRole('button', { name: 'Thông báo', exact: true });
  await expect(announcementButton).not.toContainText('1');
  await announcementButton.click();
  await expect(page.getByText('Chưa có thông báo nào', { exact: true })).toBeVisible();
});

test('list failure shows a retry state and recovers', async ({ page }) => {
  const state = await setup(page);
  state.failList = true;
  await openBell(page);
  await expect(page.getByText(/Không thể tải/)).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('Không có thông báo nào.', { exact: true })).not.toBeVisible();
  state.failList = false;
  await page.getByRole('button', { name: /Thử lại/ }).click();
  await expect(page.getByRole('button', { name: /UAT: Kiến nghị cần xem/ })).toBeVisible();
});

test('read failure still opens petition detail without unhandled errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const state = await setup(page);
  state.failRead = true;
  await openBell(page);
  await page.getByRole('button', { name: /UAT: Kiến nghị cần xem/ }).click();
  await expect(page.getByRole('dialog').getByText('Kiến nghị UAT về đèn đường', { exact: true })).toBeVisible();
  await expect.poll(() => state.readRequests).toBe(1);
  await expect(page.getByRole('alert').filter({ hasText: 'Không thể đánh dấu đã đọc thông báo' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('mark-all failure stays visible and permits retry', async ({ page }) => {
  const state = await setup(page);
  state.failRead = true;
  await openBell(page);
  await page.getByRole('button', { name: 'Đọc tất cả', exact: true }).click();
  const actionError = page.getByRole('alert').filter({ hasText: 'Không thể đánh dấu tất cả đã đọc' });
  await expect(actionError).toBeVisible();
  await expect(page.getByRole('button', { name: 'Thông báo trong ứng dụng' })).toContainText('1');
  state.failRead = false;
  await page.getByRole('button', { name: 'Đọc tất cả', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Thông báo trong ứng dụng' })).not.toContainText('1');
  await expect(actionError).not.toBeVisible();
});

test('system, unknown and missing-reference notifications never open unrelated details', async ({ page }) => {
  const state = await setup(page);
  state.items = [
    { ...petitionNotice(), id: 'system-1', type: 'system', title: 'UAT: Hệ thống' },
    { ...petitionNotice(), id: 'unknown-1', type: 'future-type', title: 'UAT: Loại khác' },
    { ...petitionNotice(), id: 'missing-1', referenceId: null, title: 'UAT: Không tham chiếu' },
  ];
  await openBell(page);
  for (const item of state.items) {
    const bell = page.getByRole('button', { name: 'Thông báo trong ứng dụng' });
    if (await bell.getAttribute('aria-expanded') !== 'true') await bell.click();
    await page.getByRole('button', { name: new RegExp(item.title) }).click();
    await expect.poll(() => item.isRead).toBe(true);
    await expect(page.getByRole('dialog')).not.toBeVisible();
  }
  expect(state.detailRequests).toEqual([]);
});

for (const [status, label] of [['processing', 'Đang xử lý'], ['resolved', 'Đã giải quyết'], ['rejected', 'Bị từ chối'], ['cancelled', 'Đã hủy']] as const) {
  test(`petition ${status} uses Vietnamese current, previous and terminal status labels`, async ({ page }) => {
    const state = await setup(page, 'leader');
    state.status = status;
    await openBell(page);
    await page.getByRole('button', { name: /UAT: Kiến nghị cần xem/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Trạng thái hiện tại:', { exact: false })).toContainText(label);
    await expect(dialog).not.toContainText(/reviewing|processing|resolved|rejected|cancelled/);
    if (status !== 'processing') await expect(dialog.getByText(/đã ở trạng thái kết thúc/)).toContainText(label);
  });
}
