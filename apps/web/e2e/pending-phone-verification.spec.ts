import { test, expect, type Page } from '@playwright/test';

// Synthetic-only fixtures. Disable artifacts for this sensitive UI workflow.
test.use({ trace: 'off', screenshot: 'off', video: 'off' });
const fixturePhone = '0900000123';
const maskedPhone = '090***0123';
const stamp = '2026-09-08T00:00:00.000Z';

type TargetStatus = 'pending' | 'active' | 'locked';

async function setup(
  page: Page,
  role: 'leader' | 'officer' = 'leader',
  targetStatus: TargetStatus = 'pending',
) {
  const state = { reveals: 0, fail: false, delayed: false, release: () => {} };
  const neighborhood = { id: 'kp-1', name: 'Khu phố UAT 1', ward: 'Phường UAT' };
  const user = {
    id: 'staff-uat',
    role,
    fullName: 'Cán bộ kiểm thử',
    status: 'active',
    neighborhoodId: 'kp-1',
    neighborhood,
    maskedPhone,
    createdAt: stamp,
    updatedAt: stamp,
  };

  const targetResident = {
    ...user,
    id: 'resident-uat',
    role: 'resident',
    status: targetStatus,
    fullName:
      targetStatus === 'pending'
        ? 'Cư dân chờ duyệt UAT'
        : targetStatus === 'active'
          ? 'Cư dân hoạt động UAT'
          : 'Cư dân tạm khóa UAT',
    address: 'Địa chỉ giả lập UAT',
    lockReason: targetStatus === 'locked' ? 'Chuyển hộ khẩu' : null,
  };

  const pendingList = targetStatus === 'pending' ? [targetResident] : [];
  const managedList = targetStatus !== 'pending' ? [targetResident] : [];

  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, '');
    const ok = (data: unknown) =>
      route.fulfill({ json: { success: true, data, timestamp: stamp } });

    if (path === '/auth/me') return ok({ user });
    if (path === '/users/pending') return ok(pendingList);
    if (path === '/users/residents')
      return ok(managedList);
    if (path === '/neighborhoods') return ok([neighborhood]);
    if (path === '/deployment-profile')
      return ok({ initialized: false, profile: null });
    if (path === '/notifications/unread-count') return ok({ unreadCount: 0 });
    if (path === '/notifications')
      return ok({ items: [], total: 0, unreadCount: 0 });
    if (path === '/notifications/push/vapid-public-key')
      return ok({ enabled: false });
    if (path === '/users/resident-uat/reveal-phone') {
      expect(route.request().method()).toBe('POST');
      state.reveals++;
      if (state.delayed)
        await new Promise<void>((resolve) => {
          state.release = resolve;
        });
      if (state.fail)
        return route.fulfill({
          status: 503,
          json: {
            success: false,
            message: 'Không thể xác minh lúc này.',
            errorCode: 'INTERNAL_SERVER_ERROR',
          },
        });
      return route.fulfill({
        headers: { 'Cache-Control': 'no-store, private' },
        json: {
          success: true,
          data: { phoneNumber: fixturePhone },
          timestamp: stamp,
        },
      });
    }
    return route.fulfill({
      status: 404,
      json: { success: false, message: 'Không có dữ liệu thử cho tiện ích này.' },
    });
  });

  await page.goto('/');

  if (role === 'officer') {
    const nav = page.getByRole('navigation', {
      name: 'Điều hướng quản trị địa bàn',
      exact: true,
    });
    await nav
      .getByRole('button', { name: /Hồ sơ chờ duyệt/ })
      .filter({ visible: true })
      .click();
  } else if (targetStatus !== 'pending') {
    const nav = page.getByRole('navigation', {
      name: 'Điều hướng quản lý',
      exact: true,
    });
    await nav
      .getByRole('button', { name: /Tài khoản cư dân/ })
      .filter({ visible: true })
      .click();
  }

  await page
    .getByRole('button', { name: 'Chi tiết tài khoản', exact: true })
    .first()
    .click();
  return state;
}

for (const role of ['leader', 'officer'] as const) {
  test(`${role}: pending resident - explicit reveal, hide and reopen preserve masked default`, async ({
    page,
  }) => {
    const state = await setup(page, role, 'pending');
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Chi tiết tài khoản')).toBeVisible();
    await expect(dialog.getByText('Chờ duyệt', { exact: true })).toBeVisible();
    await expect(dialog.getByText(maskedPhone, { exact: true })).toBeVisible();
    expect(state.reveals).toBe(0);

    await dialog
      .getByRole('button', { name: 'Xem số điện thoại', exact: true })
      .click();
    await expect(dialog.getByText(fixturePhone, { exact: true })).toBeVisible();
    expect(state.reveals).toBe(1);

    await dialog.getByRole('button', { name: /Ẩn số điện thoại/ }).click();
    await expect(
      dialog.getByText(fixturePhone, { exact: true }),
    ).not.toBeVisible();
    await expect(dialog.getByText(maskedPhone, { exact: true })).toBeVisible();

    await dialog
      .getByRole('button', { name: 'Xem số điện thoại', exact: true })
      .click();
    await expect(dialog.getByText(fixturePhone, { exact: true })).toBeVisible();
    expect(state.reveals).toBe(2);

    await dialog
      .getByRole('button', { name: 'Đóng hộp thoại', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Chi tiết tài khoản', exact: true })
      .first()
      .click();
    await expect(dialog.getByText(maskedPhone, { exact: true })).toBeVisible();
    await expect(
      dialog.getByText(fixturePhone, { exact: true }),
    ).not.toBeVisible();
    expect(state.reveals).toBe(2);

    const stored = await page.evaluate(() =>
      JSON.stringify({ ...localStorage, ...sessionStorage }),
    );
    expect(stored.includes(fixturePhone)).toBe(false);
  });
}

test('leader: active resident - explicit reveal, hide and reopen preserve masked default', async ({
  page,
}) => {
  const state = await setup(page, 'leader', 'active');
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Chi tiết tài khoản')).toBeVisible();
  await expect(dialog.getByText('Đang hoạt động', { exact: true })).toBeVisible();
  await expect(dialog.getByText(maskedPhone, { exact: true })).toBeVisible();
  expect(state.reveals).toBe(0);

  await dialog
    .getByRole('button', { name: 'Xem số điện thoại', exact: true })
    .click();
  await expect(dialog.getByText(fixturePhone, { exact: true })).toBeVisible();
  expect(state.reveals).toBe(1);

  await dialog.getByRole('button', { name: /Ẩn số điện thoại/ }).click();
  await expect(dialog.getByText(fixturePhone, { exact: true })).not.toBeVisible();
  await expect(dialog.getByText(maskedPhone, { exact: true })).toBeVisible();

  await dialog
    .getByRole('button', { name: 'Xem số điện thoại', exact: true })
    .click();
  await expect(dialog.getByText(fixturePhone, { exact: true })).toBeVisible();
  expect(state.reveals).toBe(2);

  await dialog
    .getByRole('button', { name: 'Đóng hộp thoại', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Chi tiết tài khoản', exact: true })
    .first()
    .click();
  await expect(dialog.getByText(maskedPhone, { exact: true })).toBeVisible();
  await expect(dialog.getByText(fixturePhone, { exact: true })).not.toBeVisible();
  expect(state.reveals).toBe(2);

  const stored = await page.evaluate(() =>
    JSON.stringify({ ...localStorage, ...sessionStorage }),
  );
  expect(stored.includes(fixturePhone)).toBe(false);
});

test('leader: locked resident - displays lock reason, explicit reveal, hide and reopen preserve masked default', async ({
  page,
}) => {
  const state = await setup(page, 'leader', 'locked');
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Chi tiết tài khoản')).toBeVisible();
  await expect(dialog.getByText('Đã khóa', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Chuyển hộ khẩu')).toBeVisible();
  await expect(dialog.getByText(maskedPhone, { exact: true })).toBeVisible();
  expect(state.reveals).toBe(0);

  await dialog
    .getByRole('button', { name: 'Xem số điện thoại', exact: true })
    .click();
  await expect(dialog.getByText(fixturePhone, { exact: true })).toBeVisible();
  expect(state.reveals).toBe(1);

  await dialog.getByRole('button', { name: /Ẩn số điện thoại/ }).click();
  await expect(dialog.getByText(fixturePhone, { exact: true })).not.toBeVisible();
  await expect(dialog.getByText(maskedPhone, { exact: true })).toBeVisible();

  await dialog
    .getByRole('button', { name: 'Xem số điện thoại', exact: true })
    .click();
  await expect(dialog.getByText(fixturePhone, { exact: true })).toBeVisible();
  expect(state.reveals).toBe(2);

  await dialog
    .getByRole('button', { name: 'Đóng hộp thoại', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Chi tiết tài khoản', exact: true })
    .first()
    .click();
  await expect(dialog.getByText(maskedPhone, { exact: true })).toBeVisible();
  await expect(dialog.getByText(fixturePhone, { exact: true })).not.toBeVisible();
  expect(state.reveals).toBe(2);

  const stored = await page.evaluate(() =>
    JSON.stringify({ ...localStorage, ...sessionStorage }),
  );
  expect(stored.includes(fixturePhone)).toBe(false);
});

test('reveal failure stays masked and can be retried', async ({ page }) => {
  const state = await setup(page);
  state.fail = true;
  const dialog = page.getByRole('dialog');
  await dialog
    .getByRole('button', { name: 'Xem số điện thoại', exact: true })
    .click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  await expect(dialog.getByText(maskedPhone, { exact: true })).toBeVisible();
  state.fail = false;
  await dialog
    .getByRole('button', { name: 'Thử lại', exact: true })
    .click();
  await expect(dialog.getByText(fixturePhone, { exact: true })).toBeVisible();
});

test('closing while reveal is pending discards the late response', async ({
  page,
}) => {
  const state = await setup(page);
  state.delayed = true;
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Xem số điện thoại', exact: true })
    .click();
  await expect.poll(() => state.reveals).toBe(1);
  await page
    .getByRole('button', { name: 'Đóng hộp thoại', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Chi tiết tài khoản', exact: true })
    .first()
    .click();
  state.release();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText(maskedPhone, { exact: true })).toBeVisible();
  await expect(
    dialog.getByText(fixturePhone, { exact: true }),
  ).not.toBeVisible();
  state.delayed = false;
  await dialog
    .getByRole('button', { name: 'Xem số điện thoại', exact: true })
    .click();
  await expect(dialog.getByText(fixturePhone, { exact: true })).toBeVisible();
  expect(state.reveals).toBe(2);
});
